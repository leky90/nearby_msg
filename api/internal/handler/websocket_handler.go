package handler

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"nearby-msg/api/internal/infrastructure/auth"
	"nearby-msg/api/internal/service"
	"nearby-msg/api/internal/utils"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for now (in production, validate against allowed origins)
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// WebSocketHandler handles WebSocket connections
type WebSocketHandler struct {
	wsService *service.WebSocketService
}

// NewWebSocketHandler creates a new WebSocket handler
func NewWebSocketHandler(wsService *service.WebSocketService) *WebSocketHandler {
	return &WebSocketHandler{
		wsService: wsService,
	}
}

// HandleWebSocket handles WebSocket upgrade and connection
func (h *WebSocketHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Extract token from query parameter or Authorization header
	token := r.URL.Query().Get("token")
	if token == "" {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				token = parts[1]
			}
		}
	}

	if token == "" {
		http.Error(w, "Authorization token required", http.StatusUnauthorized)
		return
	}

	// Validate token and get device ID
	deviceID, err := auth.ValidateToken(token)
	if err != nil {
		http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
		return
	}

	// Upgrade connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		WriteError(w, fmt.Errorf("failed to upgrade connection: %w", err), http.StatusInternalServerError)
		return
	}

	// Generate client ID
	clientID, err := utils.GenerateID()
	if err != nil {
		conn.Close()
		return
	}

	// Create client
	client := &service.Client{
		ID:            clientID,
		DeviceID:      deviceID,
		Conn:          &websocketConn{conn: conn},
		Subscriptions: make(map[string]bool),
		Send:          make(chan service.WebSocketMessage, 256),
		LastPing:      time.Now(),
	}

	// Register client
	h.wsService.RegisterClient(client)

	// Start client goroutines
	go h.writePump(client)
	go h.readPump(client)
}

// websocketConn wraps gorilla/websocket.Conn to implement WebSocketConnection interface
type websocketConn struct {
	conn *websocket.Conn
}

func (w *websocketConn) WriteJSON(v interface{}) error {
	return w.conn.WriteJSON(v)
}

func (w *websocketConn) ReadJSON(v interface{}) error {
	return w.conn.ReadJSON(v)
}

func (w *websocketConn) Close() error {
	return w.conn.Close()
}

func (w *websocketConn) SetReadDeadline(t time.Time) error {
	return w.conn.SetReadDeadline(t)
}

func (w *websocketConn) SetWriteDeadline(t time.Time) error {
	return w.conn.SetWriteDeadline(t)
}

func (w *websocketConn) SetPongHandler(h func(string) error) {
	w.conn.SetPongHandler(h)
}

func (w *websocketConn) SetPingHandler(h func(string) error) {
	w.conn.SetPingHandler(h)
}

func (w *websocketConn) WriteMessage(messageType int, data []byte) error {
	return w.conn.WriteMessage(messageType, data)
}

// readPump pumps messages from the WebSocket connection to the hub
func (h *WebSocketHandler) readPump(client *service.Client) {
	defer func() {
		h.wsService.UnregisterClient(client)
		client.Conn.Close()
	}()

	// Set read deadline and pong handler
	client.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	client.Conn.SetPongHandler(func(string) error {
		client.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		// Update LastPing (mu is unexported, but we can access LastPing directly in same package)
		// Since we're in handler package, we need to use a method or access via service package
		// For now, we'll just update the deadline
		return nil
	})

	for {
		var msg service.WebSocketMessage
		err := client.Conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				fmt.Printf("WebSocket error: %v\n", err)
			}
			break
		}

		// Handle message
		ctx := context.Background()
		if err := h.wsService.HandleClientMessage(ctx, client, msg); err != nil {
			errorMsg := service.WebSocketMessage{
				Type:      "error",
				Payload:   map[string]string{"error": err.Error()},
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			}
			select {
			case client.Send <- errorMsg:
			default:
				// Send buffer full, close connection
				break
			}
		}
	}
}

// writePump pumps messages from the hub to the WebSocket connection
func (h *WebSocketHandler) writePump(client *service.Client) {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		client.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-client.Send:
			client.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				// Hub closed the channel
				client.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := client.Conn.WriteJSON(message); err != nil {
				return
			}

		case <-ticker.C:
			// Send ping
			client.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := client.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
