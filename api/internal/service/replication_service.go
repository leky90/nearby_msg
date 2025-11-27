package service

import (
	"context"
	"fmt"
	"time"

	"nearby-msg/api/internal/domain"
	"nearby-msg/api/internal/infrastructure/database"
	"nearby-msg/api/internal/utils"
)

const (
	maxMessagesPerGroup    = 1000
	defaultPullLimit       = 100
	maxPullLimit           = 500
	defaultCheckpointDelta = -24 * time.Hour
)

// ReplicationService coordinates push/pull synchronization between clients and the server.
type ReplicationService struct {
	messageRepo    *database.MessageRepository
	messageService *MessageService
}

// NewReplicationService creates a new replication service.
func NewReplicationService(messageRepo *database.MessageRepository, messageService *MessageService) *ReplicationService {
	return &ReplicationService{
		messageRepo:    messageRepo,
		messageService: messageService,
	}
}

// PushMessagesRequest represents messages sent from the client to the server.
type PushMessagesRequest struct {
	Messages []PushMessage `json:"messages"`
}

// PushMessage represents a single message being pushed to the server.
type PushMessage struct {
	ID             string             `json:"id"`
	GroupID        string             `json:"group_id"`
	Content        string             `json:"content"`
	MessageType    domain.MessageType `json:"message_type"`
	SOSType        *domain.SOSType    `json:"sos_type,omitempty"`
	Tags           []string           `json:"tags,omitempty"`
	CreatedAt      *time.Time         `json:"created_at,omitempty"`
	DeviceSequence *int               `json:"device_sequence,omitempty"`
}

// PullMessagesRequest represents a request for new messages.
type PullMessagesRequest struct {
	Since *time.Time `json:"since,omitempty"`
	Limit int        `json:"limit,omitempty"`
}

// PullMessagesResponse represents the server response for new messages.
type PullMessagesResponse struct {
	Messages   []*domain.Message `json:"messages"`
	Checkpoint time.Time         `json:"checkpoint"`
}

// PushMessages stores incoming messages for the given device.
func (s *ReplicationService) PushMessages(ctx context.Context, deviceID string, req PushMessagesRequest) error {
	if len(req.Messages) == 0 {
		return nil
	}

	now := time.Now().UTC()
	var domainMessages []*domain.Message
	groupsTouched := map[string]struct{}{}

	for _, incoming := range req.Messages {
		// Check SOS cooldown if this is an SOS message
		if incoming.MessageType == domain.MessageTypeSOS {
			if s.messageService != nil {
				if err := s.messageService.CheckSOSCooldown(ctx, deviceID); err != nil {
					return fmt.Errorf("SOS cooldown check failed: %w", err)
				}
			}
		}

		messageID := incoming.ID
		if messageID == "" {
			id, err := utils.GenerateID()
			if err != nil {
				return fmt.Errorf("failed to generate message ID: %w", err)
			}
			messageID = id
		}

		createdAt := now
		if incoming.CreatedAt != nil {
			createdAt = incoming.CreatedAt.UTC()
		}

		message := &domain.Message{
			ID:             messageID,
			GroupID:        incoming.GroupID,
			DeviceID:       deviceID,
			Content:        incoming.Content,
			MessageType:    incoming.MessageType,
			SOSType:        incoming.SOSType,
			Tags:           incoming.Tags,
			Pinned:         false,
			CreatedAt:      createdAt,
			DeviceSequence: incoming.DeviceSequence,
			SyncedAt:       &now,
		}

		if err := message.Validate(); err != nil {
			return err
		}

		// Record SOS message if applicable
		if incoming.MessageType == domain.MessageTypeSOS {
			if s.messageService != nil {
				s.messageService.RecordSOSMessage(ctx, deviceID)
			}
		}

		domainMessages = append(domainMessages, message)
		groupsTouched[message.GroupID] = struct{}{}
	}

	if err := s.messageRepo.InsertMessages(ctx, domainMessages); err != nil {
		return err
	}

	// Enforce retention per group.
	for groupID := range groupsTouched {
		if s.messageService != nil {
			if err := s.messageService.EnforceRetention(ctx, groupID, maxMessagesPerGroup); err != nil {
				return fmt.Errorf("failed to enforce retention for group %s: %w", groupID, err)
			}
		} else {
			if err := s.messageRepo.TrimOldMessages(ctx, groupID, maxMessagesPerGroup); err != nil {
				return fmt.Errorf("failed to enforce retention for group %s: %w", groupID, err)
			}
		}
	}

	return nil
}

// PullMessages returns messages newer than client's checkpoint.
func (s *ReplicationService) PullMessages(ctx context.Context, deviceID string, req PullMessagesRequest) (*PullMessagesResponse, error) {
	limit := req.Limit
	if limit <= 0 {
		limit = defaultPullLimit
	} else if limit > maxPullLimit {
		limit = maxPullLimit
	}

	var since time.Time
	if req.Since != nil {
		since = req.Since.UTC()
	} else {
		checkpoint, err := s.messageRepo.GetCheckpoint(ctx, deviceID)
		if err != nil {
			// If no checkpoint exists, default to last 24 hours
			since = time.Now().UTC().Add(defaultCheckpointDelta)
		} else {
			since = checkpoint
		}
	}

	messages, err := s.messageRepo.GetMessagesAfter(ctx, since, limit)
	if err != nil {
		return nil, err
	}

	var newCheckpoint time.Time = since
	if len(messages) > 0 {
		newCheckpoint = messages[len(messages)-1].CreatedAt
		if err := s.messageRepo.UpsertCheckpoint(ctx, deviceID, newCheckpoint); err != nil {
			return nil, err
		}
	}

	return &PullMessagesResponse{
		Messages:   messages,
		Checkpoint: newCheckpoint,
	}, nil
}
