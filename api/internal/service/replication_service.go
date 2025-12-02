package service

import (
	"context"
	"fmt"
	"time"

	"nearby-msg/api/internal/domain"
	"nearby-msg/api/internal/infrastructure/database"
	"nearby-msg/api/internal/infrastructure/logging"
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
	groupService    *GroupService
	favoriteService *FavoriteService
	statusService   *StatusService
	deviceService   *DeviceService
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
	groupService *GroupService,
	favoriteService *FavoriteService,
	statusService *StatusService,
	deviceService *DeviceService,
) *ReplicationService {
	return &ReplicationService{
		messageRepo:     messageRepo,
		groupRepo:       groupRepo,
		favoriteRepo:    favoriteRepo,
		pinRepo:         pinRepo,
		statusRepo:      statusRepo,
		replicationRepo: replicationRepo,
		messageService:  messageService,
		groupService:    groupService,
		favoriteService: favoriteService,
		statusService:   statusService,
		deviceService:   deviceService,
	}
}

// PushMessagesRequest represents mutations sent from the client to the server.
// Extends existing messages-only format to support all mutation types.
type PushMessagesRequest struct {
	Messages  []PushMessage      `json:"messages,omitempty"`  // Existing messages format
	Groups    []GroupMutation    `json:"groups,omitempty"`    // NEW: Group mutations
	Favorites []FavoriteMutation `json:"favorites,omitempty"` // NEW: Favorite mutations
	Status    []StatusMutation   `json:"status,omitempty"`    // NEW: Status mutations
	Devices   []DeviceMutation   `json:"devices,omitempty"`   // NEW: Device mutations
}

// GroupMutation represents a group mutation (create or update)
type GroupMutation struct {
	ID              string   `json:"id"`                  // Group ID (client-generated for create)
	MutationType    string   `json:"mutation_type"`       // "create" or "update"
	Name            string   `json:"name,omitempty"`      // Required for create, optional for update
	Type            string   `json:"type,omitempty"`      // Required for create
	Latitude        *float64 `json:"latitude,omitempty"`  // Required for create
	Longitude       *float64 `json:"longitude,omitempty"` // Required for create
	RegionCode      *string  `json:"region_code,omitempty"`
	CreatorDeviceID string   `json:"creator_device_id,omitempty"` // Required for create
}

// FavoriteMutation represents a favorite mutation (add or remove)
type FavoriteMutation struct {
	MutationType string `json:"mutation_type"` // "add" or "remove"
	GroupID      string `json:"group_id"`      // Group ID to favorite/unfavorite
}

// StatusMutation represents a status mutation (update)
type StatusMutation struct {
	StatusType  string  `json:"status_type"`           // "safe", "need_help", "cannot_contact"
	Description *string `json:"description,omitempty"` // Optional description
}

// DeviceMutation represents a device mutation (update nickname)
type DeviceMutation struct {
	Nickname string `json:"nickname"` // Updated nickname (1-50 characters)
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
	// Location filter for groups collection (optional)
	Latitude  *float64 `json:"latitude,omitempty"`  // Location latitude for nearby groups filter
	Longitude *float64 `json:"longitude,omitempty"` // Location longitude for nearby groups filter
	Radius    *float64 `json:"radius,omitempty"`    // Radius in meters for nearby groups filter
}

// Deletion represents a deletion signal for a specific entity
type Deletion struct {
	Collection string    `json:"collection"` // Collection name (e.g., "groups", "favorite_groups")
	ID         string    `json:"id"`         // Entity ID that was deleted
	DeletedAt  time.Time `json:"deleted_at"` // When deletion occurred on server
}

// PullDocumentsResponse represents the server response for multi-collection synchronization.
// Checkpoints field provides per-collection checkpoint timestamps, allowing each collection
// to maintain its own independent checkpoint for accurate incremental synchronization.
type PullDocumentsResponse struct {
	Documents   []Document           `json:"documents"`             // Unified array of synchronized documents
	Deletions   []Deletion           `json:"deletions,omitempty"`   // Deletion signals (NEW)
	Checkpoint  time.Time            `json:"checkpoint"`            // Latest checkpoint across all documents (legacy, for backward compatibility)
	Checkpoints map[string]time.Time `json:"checkpoints,omitempty"` // Per-collection checkpoints: collection -> timestamp (each collection's checkpoint updated independently)
	HasMore     bool                 `json:"has_more"`              // Indicates whether additional data is available
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
			return fmt.Errorf("message validation failed: %w", err)
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
		return fmt.Errorf("failed to insert messages: %w", err)
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

// Note: CreateGroupRequest, UpdateGroupRequest, and UpdateStatusRequest are defined in group_service.go and status_service.go
// They're in the same package, so we can use them directly

// PushMutations handles all mutation types (groups, favorites, status, devices) from client
func (s *ReplicationService) PushMutations(ctx context.Context, deviceID string, req PushMessagesRequest) error {
	// Process group mutations FIRST
	// This ensures groups exist on server before messages reference them
	// Prevents foreign key constraint errors: "messages_group_id_fkey"
	if len(req.Groups) > 0 {
		for _, groupMut := range req.Groups {
			if groupMut.MutationType == "create" {
				// Create group
				if groupMut.Latitude == nil || groupMut.Longitude == nil {
					return fmt.Errorf("latitude and longitude are required for group creation")
				}
				if groupMut.Name == "" {
					return fmt.Errorf("name is required for group creation")
				}
				if groupMut.Type == "" {
					return fmt.Errorf("type is required for group creation")
				}
				if groupMut.CreatorDeviceID == "" {
					return fmt.Errorf("creator_device_id is required for group creation")
				}
				createReq := CreateGroupRequest{
					Name:            groupMut.Name,
					Type:            domain.GroupType(groupMut.Type),
					Latitude:        *groupMut.Latitude,
					Longitude:       *groupMut.Longitude,
					RegionCode:      groupMut.RegionCode,
					CreatorDeviceID: groupMut.CreatorDeviceID, // string from mutation, will be converted to *string in CreateGroup
				}
				// Note: Server will generate its own ID, ignoring client-provided ID
				// Client's optimistic ID will be replaced during sync
				if _, err := s.groupService.CreateGroup(ctx, createReq); err != nil {
					return fmt.Errorf("failed to create group %s: %w", groupMut.ID, err)
				}
			} else if groupMut.MutationType == "update" {
				// Update group name
				if groupMut.Name != "" {
					updateReq := UpdateGroupRequest{
						Name: groupMut.Name,
					}
					if _, err := s.groupService.UpdateGroup(ctx, groupMut.ID, deviceID, updateReq); err != nil {
						return fmt.Errorf("failed to update group %s: %w", groupMut.ID, err)
					}
				}
			}
		}
	}

	// Process messages AFTER groups are created
	// This ensures all referenced groups exist on server
	if len(req.Messages) > 0 {
		if err := s.PushMessages(ctx, deviceID, req); err != nil {
			return fmt.Errorf("failed to push messages: %w", err)
		}
	}

	// Process favorite mutations
	if len(req.Favorites) > 0 {
		for _, favMut := range req.Favorites {
			if favMut.MutationType == "add" {
				if _, err := s.favoriteService.AddFavorite(ctx, deviceID, favMut.GroupID); err != nil {
					return fmt.Errorf("failed to add favorite for group %s: %w", favMut.GroupID, err)
				}
			} else if favMut.MutationType == "remove" {
				if err := s.favoriteService.RemoveFavorite(ctx, deviceID, favMut.GroupID); err != nil {
					return fmt.Errorf("failed to remove favorite for group %s: %w", favMut.GroupID, err)
				}
			}
		}
	}

	// Process status mutations
	if len(req.Status) > 0 {
		for _, statusMut := range req.Status {
			updateReq := UpdateStatusRequest{
				StatusType:  domain.StatusType(statusMut.StatusType),
				Description: statusMut.Description,
			}
			if _, err := s.statusService.UpdateStatus(ctx, deviceID, updateReq); err != nil {
				return fmt.Errorf("failed to update status: %w", err)
			}
		}
	}

	// Process device mutations
	if len(req.Devices) > 0 {
		for _, deviceMut := range req.Devices {
			if err := s.deviceService.UpdateNickname(ctx, deviceID, deviceMut.Nickname); err != nil {
				return fmt.Errorf("failed to update device nickname: %w", err)
			}
		}
	}

	return nil
}

// getCheckpointForCollection retrieves checkpoint for a collection with fallback to default.
// This helper function eliminates duplication in checkpoint retrieval logic across PullMessages and PullDocuments.
// Returns the checkpoint from database if exists, otherwise returns defaultSince.
func (s *ReplicationService) getCheckpointForCollection(
	ctx context.Context,
	deviceID string,
	collection string,
	defaultSince time.Time,
) time.Time {
	checkpoint, err := s.replicationRepo.GetCheckpoint(ctx, deviceID, collection)
	if err != nil {
		// No checkpoint exists, return default
		return defaultSince
	}
	return checkpoint
}

// normalizeLimit validates and normalizes limit value to be between 1 and maxPullLimit.
// This helper function eliminates duplication in limit validation logic across replication endpoints.
// Returns defaultPullLimit if limit <= 0, maxPullLimit if limit > maxPullLimit, otherwise returns limit.
func normalizeLimit(limit int) int {
	if limit <= 0 {
		return defaultPullLimit
	}
	if limit > maxPullLimit {
		return maxPullLimit
	}
	return limit
}

// collectionResult holds the result of processing a collection
type collectionResult struct {
	documents  []interface{}
	checkpoint time.Time
	hasMore    bool
}

// processCollectionResult processes documents from a collection query and returns standardized result.
// This helper eliminates duplication in collection processing logic.
func processCollectionResult(
	documents interface{},
	limit int,
	getTimestamp func(interface{}) time.Time,
) *collectionResult {
	result := &collectionResult{
		documents:  []interface{}{},
		checkpoint: time.Time{},
		hasMore:    false,
	}

	// Type assertion and processing based on document type
	switch docs := documents.(type) {
	case []*domain.Message:
		if len(docs) > 0 {
			for _, doc := range docs {
				result.documents = append(result.documents, doc)
			}
			if len(docs) == limit {
				result.hasMore = true
			}
			result.checkpoint = getTimestamp(docs[len(docs)-1])
		}
	case []*domain.Group:
		if len(docs) > 0 {
			for _, doc := range docs {
				result.documents = append(result.documents, doc)
			}
			if len(docs) == limit {
				result.hasMore = true
			}
			result.checkpoint = getTimestamp(docs[len(docs)-1])
		}
	case []*domain.FavoriteGroup:
		if len(docs) > 0 {
			for _, doc := range docs {
				result.documents = append(result.documents, doc)
			}
			if len(docs) == limit {
				result.hasMore = true
			}
			result.checkpoint = getTimestamp(docs[len(docs)-1])
		}
	case []*domain.PinnedMessage:
		if len(docs) > 0 {
			for _, doc := range docs {
				result.documents = append(result.documents, doc)
			}
			if len(docs) == limit {
				result.hasMore = true
			}
			result.checkpoint = getTimestamp(docs[len(docs)-1])
		}
	case []*domain.UserStatus:
		if len(docs) > 0 {
			for _, doc := range docs {
				result.documents = append(result.documents, doc)
			}
			if len(docs) == limit {
				result.hasMore = true
			}
			result.checkpoint = getTimestamp(docs[len(docs)-1])
		}
	}

	return result
}

// PullMessages returns messages newer than client's checkpoint.
func (s *ReplicationService) PullMessages(ctx context.Context, deviceID string, req PullMessagesRequest) (*PullMessagesResponse, error) {
	limit := normalizeLimit(req.Limit)

	var since time.Time
	if req.Since != nil {
		since = req.Since.UTC()
	} else {
		// Use helper function for checkpoint retrieval
		defaultSince := time.Now().UTC().Add(defaultCheckpointDelta)
		checkpoint, err := s.messageRepo.GetCheckpoint(ctx, deviceID)
		if err != nil {
			since = defaultSince
		} else {
			since = checkpoint
		}
	}

	messages, err := s.messageRepo.GetMessagesAfter(ctx, since, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get messages after checkpoint: %w", err)
	}

	var newCheckpoint time.Time = since
	if len(messages) > 0 {
		newCheckpoint = messages[len(messages)-1].CreatedAt
		if err := s.messageRepo.UpsertCheckpoint(ctx, deviceID, newCheckpoint); err != nil {
			return nil, fmt.Errorf("failed to upsert checkpoint: %w", err)
		}
	}

	return &PullMessagesResponse{
		Messages:   messages,
		Checkpoint: newCheckpoint,
	}, nil
}

// ValidCollections is the set of allowed collection names.
// Note: For consistency, frontend uses VALID_COLLECTIONS array in web/src/services/collections.ts
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

	// Normalize limit using helper function
	limit := normalizeLimit(req.Limit)

	// Default checkpoint delta
	defaultSince := time.Now().UTC().Add(defaultCheckpointDelta)

	var allDocuments []Document
	var allDeletions []Deletion
	var latestCheckpoint time.Time = time.Time{}
	checkpoints := make(map[string]time.Time) // Per-collection checkpoints
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
			// Use helper function to get checkpoint with fallback to default
			since = s.getCheckpointForCollection(ctx, deviceID, collection, defaultSince)
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
				// Log error with structured context but continue with other collections (partial failure handling)
				logger := logging.GetLogger()
				logger.Warn("Failed to pull messages collection", "deviceID", deviceID, "collection", "messages", "error", err)
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
			var groups []*domain.Group
			var err error
			
			// Use nearby filter if location is provided
			if req.Latitude != nil && req.Longitude != nil && req.Radius != nil {
				// Use FindNearby for location-based filtering
				nearbyResults, err := s.groupRepo.FindNearby(ctx, *req.Latitude, *req.Longitude, *req.Radius)
				if err != nil {
					logger := logging.GetLogger()
					logger.Warn("Failed to pull nearby groups collection", "deviceID", deviceID, "collection", "groups", "error", err)
					continue
				}
				// Convert NearbyGroupResult to Group
				groups = make([]*domain.Group, 0, len(nearbyResults))
				for _, result := range nearbyResults {
					groups = append(groups, result.Group)
				}
			} else {
				// Fallback to GetGroupsAfter for time-based sync
				groups, err = s.groupRepo.GetGroupsAfter(ctx, since, limit)
			if err != nil {
				logger := logging.GetLogger()
				logger.Warn("Failed to pull groups collection", "deviceID", deviceID, "collection", "groups", "error", err)
				continue
			}
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
				// Log error with structured context but continue with other collections (partial failure handling)
				logger := logging.GetLogger()
				logger.Warn("Failed to pull favorite_groups collection", "deviceID", deviceID, "collection", "favorite_groups", "error", err)
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
				// Log error with structured context but continue with other collections (partial failure handling)
				logger := logging.GetLogger()
				logger.Warn("Failed to pull pinned_messages collection", "deviceID", deviceID, "collection", "pinned_messages", "error", err)
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
				// Log error with structured context but continue with other collections (partial failure handling)
				logger := logging.GetLogger()
				logger.Warn("Failed to pull user_status collection", "deviceID", deviceID, "collection", "user_status", "error", err)
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
				// Log error with structured context but continue with other collections (partial failure handling)
				logger := logging.GetLogger()
				logger.Warn("Failed to update checkpoint", "collection", collection, "deviceID", deviceID, "error", err)
				continue
			}
			// Store per-collection checkpoint
			checkpoints[collection] = collectionCheckpoint
			// Track latest checkpoint across all collections (for legacy compatibility)
			if collectionCheckpoint.After(latestCheckpoint) {
				latestCheckpoint = collectionCheckpoint
			}
		} else {
			// No new documents for this collection, but we should still return its current checkpoint if it exists
			// This ensures frontend knows the checkpoint hasn't changed
			currentCheckpoint, err := s.replicationRepo.GetCheckpoint(ctx, deviceID, collection)
			if err == nil && !currentCheckpoint.IsZero() {
				checkpoints[collection] = currentCheckpoint
			}
		}

		// Track has_more
		if collectionHasMore {
			hasMore = true
		}

		// Query deletions for this collection
		switch collection {
		case "messages":
			deletionInfos, err := s.messageRepo.GetDeletionsAfter(ctx, since, limit)
			if err != nil {
				logger := logging.GetLogger()
				logger.Warn("Failed to pull message deletions", "deviceID", deviceID, "collection", "messages", "error", err)
			} else {
				for _, del := range deletionInfos {
					allDeletions = append(allDeletions, Deletion{
						Collection: collection,
						ID:         del.ID,
						DeletedAt:  del.DeletedAt,
					})
				}
			}

		case "groups":
			deletionInfos, err := s.groupRepo.GetDeletionsAfter(ctx, since, limit)
			if err != nil {
				logger := logging.GetLogger()
				logger.Warn("Failed to pull group deletions", "deviceID", deviceID, "collection", "groups", "error", err)
			} else {
				for _, del := range deletionInfos {
					allDeletions = append(allDeletions, Deletion{
						Collection: collection,
						ID:         del.ID,
						DeletedAt:  del.DeletedAt,
					})
				}
			}

		case "favorite_groups":
			deletionInfos, err := s.favoriteRepo.GetDeletionsAfter(ctx, deviceID, since, limit)
			if err != nil {
				logger := logging.GetLogger()
				logger.Warn("Failed to pull favorite deletions", "deviceID", deviceID, "collection", "favorite_groups", "error", err)
			} else {
				for _, del := range deletionInfos {
					allDeletions = append(allDeletions, Deletion{
						Collection: collection,
						ID:         del.ID,
						DeletedAt:  del.DeletedAt,
					})
				}
			}

		case "user_status":
			deletionInfos, err := s.statusRepo.GetDeletionsAfter(ctx, deviceID, since, limit)
			if err != nil {
				logger := logging.GetLogger()
				logger.Warn("Failed to pull status deletions", "deviceID", deviceID, "collection", "user_status", "error", err)
			} else {
				for _, del := range deletionInfos {
					allDeletions = append(allDeletions, Deletion{
						Collection: collection,
						ID:         del.ID,
						DeletedAt:  del.DeletedAt,
					})
				}
			}

		case "pinned_messages":
			// Pinned messages don't have deletion sync yet (not in scope)
		}
	}

	// If no checkpoint was set, use current time
	if latestCheckpoint.IsZero() {
		latestCheckpoint = time.Now().UTC()
	}

	return &PullDocumentsResponse{
		Documents:   allDocuments,
		Deletions:   allDeletions,     // Deletion signals
		Checkpoint:  latestCheckpoint, // Legacy field for backward compatibility
		Checkpoints: checkpoints,      // Per-collection checkpoints
		HasMore:     hasMore,
	}, nil
}
