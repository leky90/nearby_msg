package service

import (
	"context"
	"fmt"
	"time"

	"nearby-msg/api/internal/domain"
	"nearby-msg/api/internal/infrastructure/database"
	"nearby-msg/api/internal/utils"
)

// MessageService handles message business logic
type MessageService struct {
	// Store last SOS timestamp per device (in-memory for now)
	// In production, this should be in Redis or database
	lastSOSTimestamps map[string]time.Time
	messageRepo       *database.MessageRepository
}

// NewMessageService creates a new message service
func NewMessageService(messageRepo *database.MessageRepository) *MessageService {
	return &MessageService{
		lastSOSTimestamps: make(map[string]time.Time),
		messageRepo:       messageRepo,
	}
}

// SOSCooldownDuration is the minimum time between SOS messages (30 seconds)
const SOSCooldownDuration = 30 * time.Second

// CheckSOSCooldown checks if a device can send an SOS message (30 second cooldown)
func (s *MessageService) CheckSOSCooldown(ctx context.Context, deviceID string) error {
	lastSOS, exists := s.lastSOSTimestamps[deviceID]
	if !exists {
		return nil // No previous SOS, allowed
	}

	timeSinceLastSOS := time.Since(lastSOS)
	if timeSinceLastSOS < SOSCooldownDuration {
		remaining := SOSCooldownDuration - timeSinceLastSOS
		return fmt.Errorf("SOS cooldown active: please wait %d more seconds", int(remaining.Seconds())+1)
	}

	return nil
}

// RecordSOSMessage records that a device sent an SOS message
func (s *MessageService) RecordSOSMessage(ctx context.Context, deviceID string) {
	s.lastSOSTimestamps[deviceID] = time.Now()
}

// CreateMessageRequest represents a message creation request
type CreateMessageRequest struct {
	GroupID        string             `json:"group_id"`
	DeviceID       string             `json:"device_id"`
	Content        string             `json:"content"`
	MessageType    domain.MessageType `json:"message_type"`
	SOSType        *domain.SOSType    `json:"sos_type,omitempty"`
	Tags           []string           `json:"tags,omitempty"`
	DeviceSequence *int               `json:"device_sequence,omitempty"`
}

// CreateMessage creates a new message with validation
func (s *MessageService) CreateMessage(ctx context.Context, req CreateMessageRequest) (*domain.Message, error) {
	// Check SOS cooldown if this is an SOS message
	if req.MessageType == domain.MessageTypeSOS {
		if err := s.CheckSOSCooldown(ctx, req.DeviceID); err != nil {
			return nil, err
		}
	}

	// Create message
	messageID, err := utils.GenerateID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate message ID: %w", err)
	}

	message := &domain.Message{
		ID:             messageID,
		GroupID:        req.GroupID,
		DeviceID:       req.DeviceID,
		Content:        req.Content,
		MessageType:    req.MessageType,
		SOSType:        req.SOSType,
		Tags:           req.Tags,
		Pinned:         false,
		CreatedAt:      time.Now(),
		DeviceSequence: req.DeviceSequence,
	}

	// Validate message
	if err := message.Validate(); err != nil {
		return nil, err
	}

	// Record SOS if applicable
	if req.MessageType == domain.MessageTypeSOS {
		s.RecordSOSMessage(ctx, req.DeviceID)
	}

	return message, nil
}

// ValidateMessage validates a message
func (s *MessageService) ValidateMessage(message *domain.Message) error {
	return message.Validate()
}

// EnforceRetention ensures groups do not exceed the maximum number of messages.
func (s *MessageService) EnforceRetention(ctx context.Context, groupID string, maxMessages int) error {
	if s.messageRepo == nil {
		return nil
	}
	return s.messageRepo.TrimOldMessages(ctx, groupID, maxMessages)
}
