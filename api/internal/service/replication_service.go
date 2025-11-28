package service

import (
	"context"
	"fmt"
	"log"
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
	messageRepo     *database.MessageRepository
	groupRepo       *database.GroupRepository
	favoriteRepo    *database.FavoriteRepository
	pinRepo         *database.PinRepository
	statusRepo      *database.StatusRepository
	replicationRepo *database.ReplicationRepository
	messageService  *MessageService
}

// NewReplicationService creates a new replication service.
func NewReplicationService(
	messageRepo *database.MessageRepository,
	groupRepo *database.GroupRepository,
	favoriteRepo *database.FavoriteRepository,
	pinRepo *database.PinRepository,
	statusRepo *database.StatusRepository,
	replicationRepo *database.ReplicationRepository,
	messageService *MessageService,
) *ReplicationService {
	return &ReplicationService{
		messageRepo:     messageRepo,
		groupRepo:       groupRepo,
		favoriteRepo:    favoriteRepo,
		pinRepo:         pinRepo,
		statusRepo:      statusRepo,
		replicationRepo: replicationRepo,
		messageService:  messageService,
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

// PullMessagesRequest represents a request for new messages (legacy format).
type PullMessagesRequest struct {
	Since *time.Time `json:"since,omitempty"`
	Limit int        `json:"limit,omitempty"`
}

// PullMessagesResponse represents the server response for new messages (legacy format).
type PullMessagesResponse struct {
	Messages   []*domain.Message `json:"messages"`
	Checkpoint time.Time         `json:"checkpoint"`
}

// Document represents a single synchronized document with its collection type identifier.
type Document struct {
	Collection string      `json:"collection"`
	Document   interface{} `json:"document"`
}

// PullDocumentsRequest represents a request to synchronize multiple collections.
type PullDocumentsRequest struct {
	Checkpoint  map[string]time.Time `json:"checkpoint,omitempty"` // Per-collection checkpoints: collection -> timestamp
	Collections []string             `json:"collections"`          // List of collections to sync
	GroupIDs    []string             `json:"group_ids,omitempty"`  // Filter messages by group IDs (messages collection only)
	Limit       int                  `json:"limit,omitempty"`      // Max documents per collection
}

// PullDocumentsResponse represents the server response for multi-collection synchronization.
type PullDocumentsResponse struct {
	Documents  []Document `json:"documents"`  // Unified array of synchronized documents
	Checkpoint time.Time  `json:"checkpoint"` // Latest checkpoint across all documents
	HasMore    bool       `json:"has_more"`   // Indicates whether additional data is available
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

// ValidCollections is the set of allowed collection names
var ValidCollections = map[string]bool{
	"messages":        true,
	"groups":          true,
	"favorite_groups": true,
	"pinned_messages": true,
	"user_status":     true,
}

// PullDocuments returns documents from multiple collections newer than client's checkpoints.
func (s *ReplicationService) PullDocuments(ctx context.Context, deviceID string, req PullDocumentsRequest) (*PullDocumentsResponse, error) {
	// Validate collections
	if len(req.Collections) == 0 {
		return nil, fmt.Errorf("collections array cannot be empty")
	}
	for _, collection := range req.Collections {
		if !ValidCollections[collection] {
			return nil, fmt.Errorf("invalid collection: %s", collection)
		}
	}

	// Set limit
	limit := req.Limit
	if limit <= 0 {
		limit = defaultPullLimit
	} else if limit > maxPullLimit {
		limit = maxPullLimit
	}

	// Default checkpoint delta
	defaultSince := time.Now().UTC().Add(defaultCheckpointDelta)

	var allDocuments []Document
	var latestCheckpoint time.Time = time.Time{}
	hasMore := false

	// Process each collection
	for _, collection := range req.Collections {
		// Get checkpoint for this collection
		var since time.Time
		if req.Checkpoint != nil {
			if checkpoint, ok := req.Checkpoint[collection]; ok {
				since = checkpoint.UTC()
			} else {
				since = defaultSince
			}
		} else {
			// Try to get from database
			checkpoint, err := s.replicationRepo.GetCheckpoint(ctx, deviceID, collection)
			if err != nil {
				// No checkpoint exists, default to last 24 hours
				since = defaultSince
			} else {
				since = checkpoint
			}
		}

		// Query documents for this collection
		var collectionDocs []interface{}
		var collectionCheckpoint time.Time = since
		var collectionHasMore bool

		switch collection {
		case "messages":
			// Apply group_ids filter if provided
			messages, err := s.messageRepo.GetMessagesAfter(ctx, since, limit)
			if err != nil {
				// Log error but continue with other collections (partial failure handling)
				log.Printf("Failed to pull messages collection for device %s: %v", deviceID, err)
				continue
			}
			if len(messages) > 0 {
				// Filter by group_ids if provided
				if len(req.GroupIDs) > 0 {
					filtered := make([]*domain.Message, 0)
					groupIDSet := make(map[string]bool)
					for _, gid := range req.GroupIDs {
						groupIDSet[gid] = true
					}
					for _, msg := range messages {
						if groupIDSet[msg.GroupID] {
							filtered = append(filtered, msg)
						}
					}
					messages = filtered
				}
				// Convert to interface{} for Document
				for _, msg := range messages {
					collectionDocs = append(collectionDocs, msg)
				}
				if len(messages) == limit {
					collectionHasMore = true
				}
				collectionCheckpoint = messages[len(messages)-1].CreatedAt
			}

		case "groups":
			groups, err := s.groupRepo.GetGroupsAfter(ctx, since, limit)
			if err != nil {
				// Log error but continue with other collections (partial failure handling)
				log.Printf("Failed to pull groups collection for device %s: %v", deviceID, err)
				continue
			}
			if len(groups) > 0 {
				for _, group := range groups {
					collectionDocs = append(collectionDocs, group)
				}
				if len(groups) == limit {
					collectionHasMore = true
				}
				collectionCheckpoint = groups[len(groups)-1].UpdatedAt
			}

		case "favorite_groups":
			favorites, err := s.favoriteRepo.GetFavoritesAfter(ctx, deviceID, since, limit)
			if err != nil {
				// Log error but continue with other collections (partial failure handling)
				log.Printf("Failed to pull favorite_groups collection for device %s: %v", deviceID, err)
				continue
			}
			if len(favorites) > 0 {
				for _, favorite := range favorites {
					collectionDocs = append(collectionDocs, favorite)
				}
				if len(favorites) == limit {
					collectionHasMore = true
				}
				collectionCheckpoint = favorites[len(favorites)-1].CreatedAt
			}

		case "pinned_messages":
			pins, err := s.pinRepo.GetPinsAfter(ctx, deviceID, since, limit)
			if err != nil {
				// Log error but continue with other collections (partial failure handling)
				log.Printf("Failed to pull pinned_messages collection for device %s: %v", deviceID, err)
				continue
			}
			if len(pins) > 0 {
				for _, pin := range pins {
					collectionDocs = append(collectionDocs, pin)
				}
				if len(pins) == limit {
					collectionHasMore = true
				}
				collectionCheckpoint = pins[len(pins)-1].PinnedAt
			}

		case "user_status":
			statuses, err := s.statusRepo.GetStatusesAfter(ctx, deviceID, since, limit)
			if err != nil {
				// Log error but continue with other collections (partial failure handling)
				log.Printf("Failed to pull user_status collection for device %s: %v", deviceID, err)
				continue
			}
			if len(statuses) > 0 {
				for _, status := range statuses {
					collectionDocs = append(collectionDocs, status)
				}
				if len(statuses) == limit {
					collectionHasMore = true
				}
				collectionCheckpoint = statuses[len(statuses)-1].UpdatedAt
			}
		}

		// Add documents to unified array
		for _, doc := range collectionDocs {
			allDocuments = append(allDocuments, Document{
				Collection: collection,
				Document:   doc,
			})
		}

		// Update checkpoint for this collection
		if len(collectionDocs) > 0 {
			if err := s.replicationRepo.UpsertCheckpoint(ctx, deviceID, collection, collectionCheckpoint); err != nil {
				// Log error but continue with other collections (partial failure handling)
				log.Printf("Failed to update checkpoint for collection %s, device %s: %v", collection, deviceID, err)
				continue
			}
			// Track latest checkpoint across all collections
			if collectionCheckpoint.After(latestCheckpoint) {
				latestCheckpoint = collectionCheckpoint
			}
		}

		// Track has_more
		if collectionHasMore {
			hasMore = true
		}
	}

	// If no checkpoint was set, use current time
	if latestCheckpoint.IsZero() {
		latestCheckpoint = time.Now().UTC()
	}

	return &PullDocumentsResponse{
		Documents:  allDocuments,
		Checkpoint: latestCheckpoint,
		HasMore:    hasMore,
	}, nil
}
