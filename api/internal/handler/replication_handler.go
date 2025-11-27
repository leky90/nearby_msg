package handler

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"nearby-msg/api/internal/infrastructure/auth"
	"nearby-msg/api/internal/service"
)

const (
	maxMessagesPerMinute = 10
	rateLimitWindow      = time.Minute
)

// ReplicationHandler handles replication push/pull endpoints.
type ReplicationHandler struct {
	replicationService *service.ReplicationService

	mu          sync.Mutex
	messageLogs map[string][]time.Time
}

// NewReplicationHandler creates a new replication handler.
func NewReplicationHandler(replicationService *service.ReplicationService) *ReplicationHandler {
	return &ReplicationHandler{
		replicationService: replicationService,
		messageLogs:        make(map[string][]time.Time),
	}
}

// Push handles POST /replicate/push
func (h *ReplicationHandler) Push(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()
	deviceID, ok := auth.GetDeviceIDFromContext(ctx)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req service.PushMessagesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if !h.allowMessages(deviceID, len(req.Messages)) {
		http.Error(w, "Rate limit exceeded (10 messages/minute)", http.StatusTooManyRequests)
		return
	}

	if err := h.replicationService.PushMessages(ctx, deviceID, req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Pull handles POST /replicate/pull
func (h *ReplicationHandler) Pull(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()
	deviceID, ok := auth.GetDeviceIDFromContext(ctx)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req service.PullMessagesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	resp, err := h.replicationService.PullMessages(ctx, deviceID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
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
