package handler

import (
	"encoding/json"
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
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req service.RegisterDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	resp, err := h.deviceService.RegisterDevice(ctx, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Generate JWT token for the device
	token, err := auth.GenerateToken(resp.Device.ID)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}
	resp.Token = token

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// GetDevice handles GET /device/{id}
func (h *DeviceHandler) GetDevice(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract device ID from path (simplified - in production use a router)
	deviceIDStr := r.URL.Query().Get("id")
	if deviceIDStr == "" {
		http.Error(w, "Device ID required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	device, err := h.deviceService.GetDevice(ctx, deviceIDStr)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(device)
}

// UpdateDevice handles PATCH /device/{id}
func (h *DeviceHandler) UpdateDevice(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract device ID from path
	deviceIDStr := r.URL.Query().Get("id")
	if deviceIDStr == "" {
		http.Error(w, "Device ID required", http.StatusBadRequest)
		return
	}

	var req struct {
		Nickname string `json:"nickname"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	if err := h.deviceService.UpdateNickname(ctx, deviceIDStr, req.Nickname); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
