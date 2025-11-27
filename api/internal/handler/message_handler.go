package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"nearby-msg/api/internal/infrastructure/auth"
	"nearby-msg/api/internal/service"
)

// MessageHandler handles message-related HTTP requests
type MessageHandler struct {
	pinService *service.PinService
}

// NewMessageHandler creates a new message handler
func NewMessageHandler(pinService *service.PinService) *MessageHandler {
	return &MessageHandler{
		pinService: pinService,
	}
}

// PinMessage handles POST /messages/{id}/pin
func (h *MessageHandler) PinMessage(w http.ResponseWriter, r *http.Request) {
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

	// Extract message ID from path
	messageID := extractMessageIDFromPath(r.URL.Path)
	if messageID == "" {
		http.Error(w, "Message ID required", http.StatusBadRequest)
		return
	}

	// Parse optional tag from request body
	var req struct {
		Tag *string `json:"tag,omitempty"`
	}
	if r.Body != nil && r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			// If body is not valid JSON, continue without tag
			req.Tag = nil
		}
	}

	pin, err := h.pinService.PinMessage(ctx, deviceID, messageID, req.Tag)
	if err != nil {
		if strings.Contains(err.Error(), "message not found") {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(pin)
}

// UnpinMessage handles DELETE /messages/{id}/pin
func (h *MessageHandler) UnpinMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()
	deviceID, ok := auth.GetDeviceIDFromContext(ctx)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract message ID from path
	messageID := extractMessageIDFromPath(r.URL.Path)
	if messageID == "" {
		http.Error(w, "Message ID required", http.StatusBadRequest)
		return
	}

	if err := h.pinService.UnpinMessage(ctx, deviceID, messageID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleMessageRoutes routes message-related requests based on path and method
func (h *MessageHandler) HandleMessageRoutes(w http.ResponseWriter, r *http.Request) {
	// Extract message ID from path: /v1/messages/{id}/pin
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	var messageID string
	var isPinRoute bool

	// Find "messages" in path and extract message ID
	for i, part := range pathParts {
		if part == "messages" && i+1 < len(pathParts) {
			messageID = pathParts[i+1]
			// Check if next part is "pin"
			if i+2 < len(pathParts) && pathParts[i+2] == "pin" {
				isPinRoute = true
			}
			break
		}
	}

	if messageID == "" {
		http.Error(w, "Message ID required", http.StatusBadRequest)
		return
	}

	if isPinRoute {
		switch r.Method {
		case http.MethodPost:
			h.PinMessage(w, r)
		case http.MethodDelete:
			h.UnpinMessage(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	http.Error(w, "Not found", http.StatusNotFound)
}

// extractMessageIDFromPath extracts message ID from URL path
func extractMessageIDFromPath(path string) string {
	pathParts := strings.Split(strings.Trim(path, "/"), "/")
	for i, part := range pathParts {
		if part == "messages" && i+1 < len(pathParts) {
			return pathParts[i+1]
		}
	}
	return ""
}

