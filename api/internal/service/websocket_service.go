package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"sync"
	"time"

	"nearby-msg/api/internal/domain"
)

// WebSocketMessage represents a WebSocket message
type WebSocketMessage struct {
	Type      string      `json:"type"`
	Payload   interface{} `json:"payload"`
	Timestamp string      `json:"timestamp,omitempty"`
	MessageID string      `json:"messageId,omitempty"`
}

// Client represents a WebSocket client connection
type Client struct {
	ID           string
	DeviceID     string
	Conn         WebSocketConnection
	Subscriptions map[string]bool // group IDs this client is subscribed to
	Send         chan WebSocketMessage
	LastPing     time.Time
	mu           sync.RWMutex
}

// WebSocketConnection interface for WebSocket operations
type WebSocketConnection interface {
	WriteJSON(v interface{}) error
	ReadJSON(v interface{}) error
	WriteMessage(messageType int, data []byte) error
	Close() error
	SetReadDeadline(t time.Time) error
	SetWriteDeadline(t time.Time) error
	SetPongHandler(h func(string) error)
	SetPingHandler(h func(string) error)
	NextReader() (int, io.Reader, error)
}

// WebSocketService manages WebSocket connections and message broadcasting
type WebSocketService struct {
	clients       map[string]*Client // client ID -> client
	groups        map[string]map[string]bool // group ID -> set of client IDs
	register      chan *Client
	unregister    chan *Client
	broadcast     chan BroadcastMessage
	mu            sync.RWMutex
	messageService *MessageService
	messageRepo   MessageRepository
	pinService    *PinService
}

// BroadcastMessage represents a message to broadcast
type BroadcastMessage struct {
	GroupID string
	Message WebSocketMessage
}

// MessageRepository interface for message persistence
type MessageRepository interface {
	InsertMessages(ctx context.Context, messages []*domain.Message) error
	GetByID(ctx context.Context, messageID string) (*domain.Message, error)
}

// NewWebSocketService creates a new WebSocket service
func NewWebSocketService(messageService *MessageService, messageRepo MessageRepository, pinService *PinService) *WebSocketService {
	return &WebSocketService{
		clients:        make(map[string]*Client),
		groups:         make(map[string]map[string]bool),
		register:       make(chan *Client),
		unregister:     make(chan *Client),
		broadcast:      make(chan BroadcastMessage, 256),
		messageService: messageService,
		messageRepo:    messageRepo,
		pinService:     pinService,
	}
}

// Run starts the WebSocket service hub
func (s *WebSocketService) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case client := <-s.register:
			s.registerClient(client)
		case client := <-s.unregister:
			s.unregisterClient(client)
		case broadcast := <-s.broadcast:
			s.broadcastToGroup(broadcast.GroupID, broadcast.Message)
		}
	}
}

// RegisterClient registers a new WebSocket client
func (s *WebSocketService) RegisterClient(client *Client) {
	s.register <- client
}

// UnregisterClient unregisters a WebSocket client
func (s *WebSocketService) UnregisterClient(client *Client) {
	s.unregister <- client
}

// BroadcastToGroup broadcasts a message to all clients subscribed to a group
func (s *WebSocketService) BroadcastToGroup(groupID string, message WebSocketMessage) {
	s.broadcast <- BroadcastMessage{GroupID: groupID, Message: message}
}

// registerClient adds a client to the service
func (s *WebSocketService) registerClient(client *Client) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.clients[client.ID] = client
	log.Printf("WebSocket client registered: %s (device: %s)", client.ID, client.DeviceID)

	// Send connection confirmation
	go func() {
		msg := WebSocketMessage{
			Type:      "connected",
			Payload:   map[string]string{"clientId": client.ID},
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
		select {
		case client.Send <- msg:
		case <-time.After(5 * time.Second):
			log.Printf("Timeout sending connection message to client %s", client.ID)
		}
	}()
}

// unregisterClient removes a client from the service
func (s *WebSocketService) unregisterClient(client *Client) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.clients[client.ID]; !ok {
		return
	}

	// Remove client from all groups
	for groupID := range client.Subscriptions {
		if clients, ok := s.groups[groupID]; ok {
			delete(clients, client.ID)
			if len(clients) == 0 {
				delete(s.groups, groupID)
			}
		}
	}

	delete(s.clients, client.ID)
	close(client.Send)
	log.Printf("WebSocket client unregistered: %s", client.ID)
}

// broadcastToGroup sends a message to all clients subscribed to a group
func (s *WebSocketService) broadcastToGroup(groupID string, message WebSocketMessage) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	clients, ok := s.groups[groupID]
	if !ok {
		return
	}

	for clientID := range clients {
		client, ok := s.clients[clientID]
		if !ok {
			continue
		}

		select {
		case client.Send <- message:
		default:
			log.Printf("Client %s send buffer full, closing connection", clientID)
			close(client.Send)
			delete(s.clients, clientID)
		}
	}
}

// SubscribeClient subscribes a client to a group
func (s *WebSocketService) SubscribeClient(clientID string, groupIDs []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	client, ok := s.clients[clientID]
	if !ok {
		return fmt.Errorf("client not found: %s", clientID)
	}

	client.mu.Lock()
	for _, groupID := range groupIDs {
		if _, exists := s.groups[groupID]; !exists {
			s.groups[groupID] = make(map[string]bool)
		}
		s.groups[groupID][clientID] = true
		client.Subscriptions[groupID] = true
	}
	client.mu.Unlock()

	return nil
}

// UnsubscribeClient unsubscribes a client from groups
func (s *WebSocketService) UnsubscribeClient(clientID string, groupIDs []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	client, ok := s.clients[clientID]
	if !ok {
		return fmt.Errorf("client not found: %s", clientID)
	}

	client.mu.Lock()
	for _, groupID := range groupIDs {
		if clients, ok := s.groups[groupID]; ok {
			delete(clients, clientID)
			if len(clients) == 0 {
				delete(s.groups, groupID)
			}
		}
		delete(client.Subscriptions, groupID)
	}
	client.mu.Unlock()

	return nil
}

// HandleClientMessage processes incoming messages from a client
func (s *WebSocketService) HandleClientMessage(ctx context.Context, client *Client, msg WebSocketMessage) error {
	switch msg.Type {
	case "subscribe":
		var payload struct {
			GroupIDs []string `json:"groupIds"`
		}
		if p, ok := msg.Payload.(map[string]interface{}); ok {
			if ids, ok := p["groupIds"].([]interface{}); ok {
				groupIDs := make([]string, 0, len(ids))
				for _, id := range ids {
					if str, ok := id.(string); ok {
						groupIDs = append(groupIDs, str)
					}
				}
				payload.GroupIDs = groupIDs
			}
		} else {
			// Try to unmarshal from JSON
			payloadBytes, _ := json.Marshal(msg.Payload)
			json.Unmarshal(payloadBytes, &payload)
		}

		if err := s.SubscribeClient(client.ID, payload.GroupIDs); err != nil {
			return fmt.Errorf("failed to subscribe: %w", err)
		}

		// Send confirmation
		response := WebSocketMessage{
			Type:      "subscribed",
			Payload:   map[string]interface{}{"groupIds": payload.GroupIDs},
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
		select {
		case client.Send <- response:
		case <-time.After(5 * time.Second):
			log.Printf("Timeout sending subscription confirmation to client %s", client.ID)
		}

	case "unsubscribe":
		var payload struct {
			GroupIDs []string `json:"groupIds"`
		}
		if p, ok := msg.Payload.(map[string]interface{}); ok {
			if ids, ok := p["groupIds"].([]interface{}); ok {
				groupIDs := make([]string, 0, len(ids))
				for _, id := range ids {
					if str, ok := id.(string); ok {
						groupIDs = append(groupIDs, str)
					}
				}
				payload.GroupIDs = groupIDs
			}
		} else {
			payloadBytes, _ := json.Marshal(msg.Payload)
			json.Unmarshal(payloadBytes, &payload)
		}

		if err := s.UnsubscribeClient(client.ID, payload.GroupIDs); err != nil {
			return fmt.Errorf("failed to unsubscribe: %w", err)
		}

		// Send confirmation
		response := WebSocketMessage{
			Type:      "unsubscribed",
			Payload:   map[string]interface{}{"groupIds": payload.GroupIDs},
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
		select {
		case client.Send <- response:
		case <-time.After(5 * time.Second):
			log.Printf("Timeout sending unsubscription confirmation to client %s", client.ID)
		}

	case "send_message":
		var payload struct {
			GroupID        string   `json:"groupId"`
			Content        string   `json:"content"`
			MessageType    string   `json:"messageType"`
			SOSType        *string  `json:"sosType,omitempty"`
			Tags           []string `json:"tags,omitempty"`
			DeviceSequence *int     `json:"deviceSequence,omitempty"`
		}

		// Parse payload
		if p, ok := msg.Payload.(map[string]interface{}); ok {
			if gid, ok := p["groupId"].(string); ok {
				payload.GroupID = gid
			}
			if content, ok := p["content"].(string); ok {
				payload.Content = content
			}
			if mt, ok := p["messageType"].(string); ok {
				payload.MessageType = mt
			}
			if st, ok := p["sosType"].(string); ok {
				payload.SOSType = &st
			}
			if tags, ok := p["tags"].([]interface{}); ok {
				payload.Tags = make([]string, 0, len(tags))
				for _, tag := range tags {
					if str, ok := tag.(string); ok {
						payload.Tags = append(payload.Tags, str)
					}
				}
			}
			if ds, ok := p["deviceSequence"].(float64); ok {
				seq := int(ds)
				payload.DeviceSequence = &seq
			}
		} else {
			payloadBytes, _ := json.Marshal(msg.Payload)
			json.Unmarshal(payloadBytes, &payload)
		}

		// Create message using message service
		msgType := domain.MessageTypeText
		if payload.MessageType == "sos" {
			msgType = domain.MessageTypeSOS
		}

		var sosType *domain.SOSType
		if payload.SOSType != nil {
			st := domain.SOSType(*payload.SOSType)
			sosType = &st
		}

		createReq := CreateMessageRequest{
			GroupID:        payload.GroupID,
			DeviceID:       client.DeviceID,
			Content:        payload.Content,
			MessageType:    msgType,
			SOSType:        sosType,
			Tags:           payload.Tags,
			DeviceSequence: payload.DeviceSequence,
		}

		message, err := s.messageService.CreateMessage(ctx, createReq)
		if err != nil {
			errorMsg := WebSocketMessage{
				Type:      "message_error",
				Payload:   map[string]string{"error": err.Error()},
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			}
			select {
			case client.Send <- errorMsg:
			case <-time.After(5 * time.Second):
			}
			return err
		}

		// Save message to database
		if err := s.messageRepo.InsertMessages(ctx, []*domain.Message{message}); err != nil {
			errorMsg := WebSocketMessage{
				Type:      "message_error",
				Payload:   map[string]string{"error": fmt.Sprintf("failed to save message: %v", err)},
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			}
			select {
			case client.Send <- errorMsg:
			case <-time.After(5 * time.Second):
			}
			return fmt.Errorf("failed to save message: %w", err)
		}

		// Validate GroupID before broadcasting
		if payload.GroupID == "" {
			errorMsg := WebSocketMessage{
				Type:      "message_error",
				Payload:   map[string]string{"error": "groupId is required"},
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			}
			select {
			case client.Send <- errorMsg:
			case <-time.After(5 * time.Second):
			}
			return fmt.Errorf("groupId is required")
		}

		// Convert to WebSocket message format
		newMsg := WebSocketMessage{
			Type: "new_message",
			Payload: map[string]interface{}{
				"id":             message.ID,
				"groupId":        message.GroupID,
				"deviceId":       message.DeviceID,
				"content":        message.Content,
				"messageType":    string(message.MessageType),
				"sosType":        message.SOSType,
				"tags":           message.Tags,
				"pinned":         message.Pinned,
				"createdAt":      message.CreatedAt.Format(time.RFC3339),
				"deviceSequence": message.DeviceSequence,
			},
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}

		// Broadcast to all subscribers of the group
		// Use message.GroupID (from DB) instead of payload.GroupID to ensure consistency
		s.BroadcastToGroup(message.GroupID, newMsg)

		// Send confirmation to sender
		confirmMsg := WebSocketMessage{
			Type:      "message_sent",
			Payload:   map[string]string{"messageId": message.ID},
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
		select {
		case client.Send <- confirmMsg:
		case <-time.After(5 * time.Second):
		}

	case "ping":
		// Respond with pong
		response := WebSocketMessage{
			Type:      "pong",
			Payload:   map[string]string{},
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
		select {
		case client.Send <- response:
		case <-time.After(5 * time.Second):
		}

	case "pin_message":
		var payload struct {
			MessageID string  `json:"messageId"`
			GroupID   string  `json:"groupId"`
			Tag       *string `json:"tag,omitempty"`
			PinnedAt  string  `json:"pinnedAt,omitempty"`
		}

		// Parse payload
		if p, ok := msg.Payload.(map[string]interface{}); ok {
			if mid, ok := p["messageId"].(string); ok {
				payload.MessageID = mid
			}
			if gid, ok := p["groupId"].(string); ok {
				payload.GroupID = gid
			}
			if tagVal, ok := p["tag"]; ok {
				if tagStr, ok := tagVal.(string); ok {
					payload.Tag = &tagStr
				} else if tagVal == nil {
					payload.Tag = nil
				}
			}
			if pat, ok := p["pinnedAt"].(string); ok {
				payload.PinnedAt = pat
			}
		} else {
			payloadBytes, _ := json.Marshal(msg.Payload)
			json.Unmarshal(payloadBytes, &payload)
		}

		if payload.MessageID == "" {
			errorMsg := WebSocketMessage{
				Type:      "error",
				Payload:   map[string]string{"error": "messageId is required"},
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			}
			select {
			case client.Send <- errorMsg:
			case <-time.After(5 * time.Second):
			}
			return fmt.Errorf("messageId is required")
		}

		// Pin message using pin service
		pin, err := s.pinService.PinMessage(ctx, client.DeviceID, payload.MessageID, payload.Tag)
		if err != nil {
			errorMsg := WebSocketMessage{
				Type:      "error",
				Payload:   map[string]string{"error": err.Error()},
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			}
			select {
			case client.Send <- errorMsg:
			case <-time.After(5 * time.Second):
			}
			return fmt.Errorf("failed to pin message: %w", err)
		}

		// Get group ID from pin (it's set by PinMessage)
		groupID := pin.GroupID

		// Broadcast message_pinned event to all subscribers of the group
		pinnedMsg := WebSocketMessage{
			Type: "message_pinned",
			Payload: map[string]interface{}{
				"messageId": pin.MessageID,
				"groupId":   groupID,
				"deviceId":  pin.DeviceID,
				"pinnedAt":  pin.PinnedAt.Format(time.RFC3339),
				"tag":       pin.Tag,
			},
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
		s.BroadcastToGroup(groupID, pinnedMsg)

	case "unpin_message":
		var payload struct {
			MessageID string `json:"messageId"`
		}

		// Parse payload
		if p, ok := msg.Payload.(map[string]interface{}); ok {
			if mid, ok := p["messageId"].(string); ok {
				payload.MessageID = mid
			}
		} else {
			payloadBytes, _ := json.Marshal(msg.Payload)
			json.Unmarshal(payloadBytes, &payload)
		}

		if payload.MessageID == "" {
			errorMsg := WebSocketMessage{
				Type:      "error",
				Payload:   map[string]string{"error": "messageId is required"},
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			}
			select {
			case client.Send <- errorMsg:
			case <-time.After(5 * time.Second):
			}
			return fmt.Errorf("messageId is required")
		}

		// Get message to find group ID before unpinning
		message, err := s.messageRepo.GetByID(ctx, payload.MessageID)
		if err != nil {
			errorMsg := WebSocketMessage{
				Type:      "error",
				Payload:   map[string]string{"error": fmt.Sprintf("failed to get message: %v", err)},
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			}
			select {
			case client.Send <- errorMsg:
			case <-time.After(5 * time.Second):
			}
			return fmt.Errorf("failed to get message: %w", err)
		}
		if message == nil {
			errorMsg := WebSocketMessage{
				Type:      "error",
				Payload:   map[string]string{"error": "message not found"},
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			}
			select {
			case client.Send <- errorMsg:
			case <-time.After(5 * time.Second):
			}
			return fmt.Errorf("message not found")
		}
		groupID := message.GroupID

		// Unpin message using pin service
		if err := s.pinService.UnpinMessage(ctx, client.DeviceID, payload.MessageID); err != nil {
			errorMsg := WebSocketMessage{
				Type:      "error",
				Payload:   map[string]string{"error": err.Error()},
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			}
			select {
			case client.Send <- errorMsg:
			case <-time.After(5 * time.Second):
			}
			return fmt.Errorf("failed to unpin message: %w", err)
		}

		// Broadcast message_unpinned event to all subscribers of the group
		unpinnedMsg := WebSocketMessage{
			Type: "message_unpinned",
			Payload: map[string]interface{}{
				"messageId": payload.MessageID,
				"groupId":   groupID,
				"deviceId":  client.DeviceID,
			},
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
		s.BroadcastToGroup(groupID, unpinnedMsg)

	default:
		return fmt.Errorf("unknown message type: %s", msg.Type)
	}

	return nil
}
