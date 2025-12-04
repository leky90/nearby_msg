package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"nearby-msg/api/internal/infrastructure/auth"
	"nearby-msg/api/internal/service"
)

const (
	maxMessagesPerMinute = 10
	rateLimitWindow      = time.Minute

	// Additional SOS-specific limit (defence-in-depth, besides cooldown in MessageService)
	maxSOSPerHour = 6
	sosWindow     = time.Hour
)

// ReplicationHandler handles replication push/pull endpoints.
type ReplicationHandler struct {
	replicationService *service.ReplicationService

	mu          sync.Mutex
	messageLogs map[string][]time.Time
	sosLogs     map[string][]time.Time
}

// NewReplicationHandler creates a new replication handler.
func NewReplicationHandler(replicationService *service.ReplicationService) *ReplicationHandler {
	return &ReplicationHandler{
		replicationService: replicationService,
		messageLogs:        make(map[string][]time.Time),
		sosLogs:            make(map[string][]time.Time),
	}
}

// Push handles POST /replicate/push
func (h *ReplicationHandler) Push(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()
	deviceID, ok := auth.GetDeviceIDFromContext(ctx)
	if !ok {
		WriteError(w, fmt.Errorf("unauthorized"), http.StatusUnauthorized)
		return
	}

	var req service.PushMessagesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
		return
	}

	// Check if request has any mutations (messages or other types)
	hasMutations := len(req.Messages) > 0 || len(req.Groups) > 0 || len(req.Favorites) > 0 || len(req.Status) > 0 || len(req.Devices) > 0

	if !hasMutations {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Rate limit only for messages (existing behavior)
	if len(req.Messages) > 0 {
		// Generic per-message limit
		if !h.allowMessages(deviceID, len(req.Messages)) {
			WriteError(w, fmt.Errorf("rate limit exceeded (max %d messages/minute)", maxMessagesPerMinute), http.StatusTooManyRequests)
			return
		}

		// SOS-specific limit (count how many SOS messages are in this batch)
		sosCount := 0
		for _, msg := range req.Messages {
			if msg.MessageType == domain.MessageTypeSOS {
				sosCount++
			}
		}
		if sosCount > 0 && !h.allowSOS(deviceID, sosCount) {
			WriteError(w, fmt.Errorf("SOS rate limit exceeded (max %d SOS/hour)", maxSOSPerHour), http.StatusTooManyRequests)
			return
		}
	}

	// Use PushMutations to handle all mutation types
	if err := h.replicationService.PushMutations(ctx, deviceID, req); err != nil {
		WriteError(w, err, http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Pull handles POST /replicate/pull
// Supports both legacy format (messages-only) and new format (multi-collection)
func (h *ReplicationHandler) Pull(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()
	deviceID, ok := auth.GetDeviceIDFromContext(ctx)
	if !ok {
		WriteError(w, fmt.Errorf("unauthorized"), http.StatusUnauthorized)
		return
	}

	// Read body bytes (can only read once)
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		WriteError(w, fmt.Errorf("failed to read request body: %w", err), http.StatusBadRequest)
		return
	}
	r.Body.Close()

	// Decode to detect format
	var rawReq map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &rawReq); err != nil {
		WriteError(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
		return
	}

	// Detect request format: new format has "collections" field
	_, hasCollections := rawReq["collections"]

	// If collections not provided, default to legacy format (messages only)
	if !hasCollections {
		// Legacy format: messages only
		var legacyReq service.PullMessagesRequest
		if err := json.Unmarshal(bodyBytes, &legacyReq); err != nil {
			WriteError(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
			return
		}

		resp, err := h.replicationService.PullMessages(ctx, deviceID, legacyReq)
		if err != nil {
			WriteError(w, err, http.StatusBadRequest)
			return
		}

		WriteJSON(w, http.StatusOK, resp)
		return
	}

	// New format: multi-collection
	var req service.PullDocumentsRequest
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		WriteError(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
		return
	}

	// Validate collections
	if len(req.Collections) == 0 {
		WriteError(w, fmt.Errorf("collections array cannot be empty"), http.StatusBadRequest)
		return
	}

	// Validate each collection name
	for _, collection := range req.Collections {
		if !service.ValidCollections[collection] {
			WriteError(w, fmt.Errorf("invalid collection: %s", collection), http.StatusBadRequest)
			return
		}
	}

	resp, err := h.replicationService.PullDocuments(ctx, deviceID, req)
	if err != nil {
		WriteError(w, err, http.StatusBadRequest)
		return
	}

	WriteJSON(w, http.StatusOK, resp)
}

func (h *ReplicationHandler) allowMessages(deviceID string, count int) bool {
	if count <= 0 {
		return true
	}

	now := time.Now()
	windowStart := now.Add(-rateLimitWindow)

	h.mu.Lock()
	defer h.mu.Unlock()

	log := h.messageLogs[deviceID]
	var filtered []time.Time
	for _, ts := range log {
		if ts.After(windowStart) {
			filtered = append(filtered, ts)
		}
	}

	if len(filtered)+count > maxMessagesPerMinute {
		return false
	}

	for i := 0; i < count; i++ {
		filtered = append(filtered, now)
	}
	h.messageLogs[deviceID] = filtered
	return true
}

// allowSOS enforces an additional per-device SOS rate limit over a longer window.
// This is in addition to the cooldown enforced in MessageService.
func (h *ReplicationHandler) allowSOS(deviceID string, count int) bool {
	if count <= 0 {
		return true
	}

	now := time.Now()
	windowStart := now.Add(-sosWindow)

	h.mu.Lock()
	defer h.mu.Unlock()

	log := h.sosLogs[deviceID]
	var filtered []time.Time
	for _, ts := range log {
		if ts.After(windowStart) {
			filtered = append(filtered, ts)
		}
	}

	if len(filtered)+count > maxSOSPerHour {
		return false
	}

	for i := 0; i < count; i++ {
		filtered = append(filtered, now)
	}
	h.sosLogs[deviceID] = filtered
	return true
}
