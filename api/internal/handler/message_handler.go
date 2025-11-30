package handler

import (
	"encoding/json"
	"fmt"
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
		WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()
	deviceID, ok := auth.GetDeviceIDFromContext(ctx)
	if !ok {
		WriteError(w, fmt.Errorf("unauthorized"), http.StatusUnauthorized)
		return
	}

	// Extract message ID from path
	messageID := extractMessageIDFromPath(r.URL.Path)
	if messageID == "" {
		WriteError(w, fmt.Errorf("message ID required"), http.StatusBadRequest)
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
			WriteError(w, err, http.StatusNotFound)
			return
		}
		WriteError(w, err, http.StatusBadRequest)
		return
	}

	WriteJSON(w, http.StatusCreated, pin)
}

// UnpinMessage handles DELETE /messages/{id}/pin
func (h *MessageHandler) UnpinMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()
	deviceID, ok := auth.GetDeviceIDFromContext(ctx)
	if !ok {
		WriteError(w, fmt.Errorf("unauthorized"), http.StatusUnauthorized)
		return
	}

	// Extract message ID from path
	messageID := extractMessageIDFromPath(r.URL.Path)
	if messageID == "" {
		WriteError(w, fmt.Errorf("message ID required"), http.StatusBadRequest)
		return
	}

	if err := h.pinService.UnpinMessage(ctx, deviceID, messageID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			WriteError(w, err, http.StatusNotFound)
			return
		}
		WriteError(w, err, http.StatusBadRequest)
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
		WriteError(w, fmt.Errorf("message ID required"), http.StatusBadRequest)
		return
	}

	if isPinRoute {
		switch r.Method {
		case http.MethodPost:
			h.PinMessage(w, r)
		case http.MethodDelete:
			h.UnpinMessage(w, r)
		default:
			WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		}
		return
	}

	WriteError(w, fmt.Errorf("not found"), http.StatusNotFound)
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
