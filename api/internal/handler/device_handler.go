package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"nearby-msg/api/internal/infrastructure/auth"
	"nearby-msg/api/internal/service"
)

// DeviceHandler handles device-related HTTP requests
type DeviceHandler struct {
	deviceService *service.DeviceService
}

// NewDeviceHandler creates a new device handler
func NewDeviceHandler(deviceService *service.DeviceService) *DeviceHandler {
	return &DeviceHandler{deviceService: deviceService}
}

// RegisterDevice handles POST /device/register
func (h *DeviceHandler) RegisterDevice(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	var req service.RegisterDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	resp, err := h.deviceService.RegisterDevice(ctx, req)
	if err != nil {
		WriteError(w, err, http.StatusBadRequest)
		return
	}

	// Generate JWT token for the device
	token, err := auth.GenerateToken(resp.Device.ID)
	if err != nil {
		WriteError(w, fmt.Errorf("failed to generate token: %w", err), http.StatusInternalServerError)
		return
	}
	resp.Token = token

	WriteJSON(w, http.StatusOK, resp)
}

// GetDevice handles GET /device/{id}
func (h *DeviceHandler) GetDevice(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	// Extract device ID from path (simplified - in production use a router)
	deviceIDStr := r.URL.Query().Get("id")
	if deviceIDStr == "" {
		WriteError(w, fmt.Errorf("device ID required"), http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	device, err := h.deviceService.GetDevice(ctx, deviceIDStr)
	if err != nil {
		WriteError(w, err, http.StatusNotFound)
		return
	}

	WriteJSON(w, http.StatusOK, device)
}

// UpdateDevice handles PATCH /device/{id}
func (h *DeviceHandler) UpdateDevice(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	// Extract device ID from path
	deviceIDStr := r.URL.Query().Get("id")
	if deviceIDStr == "" {
		WriteError(w, fmt.Errorf("device ID required"), http.StatusBadRequest)
		return
	}

	var req struct {
		Nickname string `json:"nickname"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	if err := h.deviceService.UpdateNickname(ctx, deviceIDStr, req.Nickname); err != nil {
		WriteError(w, err, http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// DeleteDevice handles DELETE /device/{id}
func (h *DeviceHandler) DeleteDevice(w http.ResponseWriter, r *http.Request) {
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

	if err := h.deviceService.DeleteDevice(ctx, deviceID); err != nil {
		if err.Error() == "device not found" {
			WriteError(w, err, http.StatusNotFound)
			return
		}
		WriteError(w, err, http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
