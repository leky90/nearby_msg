package handler

import (
	"fmt"
	"net/http"

	"nearby-msg/api/internal/service"
)

// StatusHandler handles status-related HTTP requests
type StatusHandler struct {
	statusService *service.StatusService
}

// NewStatusHandler creates a new status handler
func NewStatusHandler(statusService *service.StatusService) *StatusHandler {
	return &StatusHandler{statusService: statusService}
}

// UpdateStatus handles PUT /status
func (h *StatusHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	if !RequireMethod(w, r, http.MethodPut) {
		return
	}

	deviceID, ok := RequireAuth(w, r)
	if !ok {
		return
	}

	ctx := r.Context()
	var req service.UpdateStatusRequest
	if err := DecodeJSON(w, r, &req); err != nil {
		return
	}

	status, err := h.statusService.UpdateStatus(ctx, deviceID, req)
	if err != nil {
		WriteError(w, err, http.StatusBadRequest)
		return
	}

	WriteJSON(w, http.StatusOK, status)
}

// GetStatus handles GET /status
func (h *StatusHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	if !RequireMethod(w, r, http.MethodGet) {
		return
	}

	deviceID, ok := RequireAuth(w, r)
	if !ok {
		return
	}

	ctx := r.Context()
	status, err := h.statusService.GetStatus(ctx, deviceID)
	if err != nil {
		WriteError(w, err, http.StatusInternalServerError)
		return
	}

	// If no status found, return 404
	if status == nil {
		WriteError(w, fmt.Errorf("status not found"), http.StatusNotFound)
		return
	}

	WriteJSON(w, http.StatusOK, status)
}
