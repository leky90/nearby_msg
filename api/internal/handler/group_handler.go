package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"nearby-msg/api/internal/infrastructure/auth"
	"nearby-msg/api/internal/service"
)

// GroupHandler handles group-related HTTP requests
type GroupHandler struct {
	groupService    *service.GroupService
	favoriteService *service.FavoriteService
	statusService   *service.StatusService
	pinService      *service.PinService
}

// NewGroupHandler creates a new group handler
func NewGroupHandler(groupService *service.GroupService, favoriteService *service.FavoriteService, statusService *service.StatusService, pinService *service.PinService) *GroupHandler {
	return &GroupHandler{
		groupService:    groupService,
		favoriteService: favoriteService,
		statusService:   statusService,
		pinService:      pinService,
	}
}

// GetNearbyGroups handles GET /groups/nearby
func (h *GroupHandler) GetNearbyGroups(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	// Extract query parameters
	latStr := r.URL.Query().Get("latitude")
	lonStr := r.URL.Query().Get("longitude")
	radiusStr := r.URL.Query().Get("radius")

	if latStr == "" || lonStr == "" || radiusStr == "" {
		WriteError(w, fmt.Errorf("latitude, longitude, and radius are required"), http.StatusBadRequest)
		return
	}

	latitude, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		WriteError(w, fmt.Errorf("invalid latitude: %w", err), http.StatusBadRequest)
		return
	}

	longitude, err := strconv.ParseFloat(lonStr, 64)
	if err != nil {
		WriteError(w, fmt.Errorf("invalid longitude: %w", err), http.StatusBadRequest)
		return
	}

	radius, err := strconv.ParseFloat(radiusStr, 64)
	if err != nil {
		WriteError(w, fmt.Errorf("invalid radius: %w", err), http.StatusBadRequest)
		return
	}

	// Validate radius (500, 1000, or 2000 meters)
	if err := service.ValidateRadius(radius); err != nil {
		WriteError(w, err, http.StatusBadRequest)
		return
	}

	// Validate latitude/longitude ranges
	if latitude < -90 || latitude > 90 {
		WriteError(w, fmt.Errorf("latitude must be between -90 and 90"), http.StatusBadRequest)
		return
	}
	if longitude < -180 || longitude > 180 {
		WriteError(w, fmt.Errorf("longitude must be between -180 and 180"), http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	req := service.NearbyGroupsRequest{
		Latitude:  latitude,
		Longitude: longitude,
		Radius:    radius,
	}

	groups, err := h.groupService.FindNearbyGroups(ctx, req)
	if err != nil {
		WriteError(w, err, http.StatusInternalServerError)
		return
	}

	WriteJSON(w, http.StatusOK, groups)
}

// CreateGroup handles POST /groups
func (h *GroupHandler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	// Get device ID from context (set by auth middleware)
	ctx := r.Context()
	deviceID, ok := auth.GetDeviceIDFromContext(ctx)
	if !ok {
		WriteError(w, fmt.Errorf("unauthorized"), http.StatusUnauthorized)
		return
	}

	var req service.CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
		return
	}

	req.CreatorDeviceID = deviceID

	group, err := h.groupService.CreateGroup(ctx, req)
	if err != nil {
		// Check if error is "device has already created a group" - return 409 Conflict
		if err.Error() == "device has already created a group" {
			WriteError(w, err, http.StatusConflict)
			return
		}
		WriteError(w, err, http.StatusBadRequest)
		return
	}

	WriteJSON(w, http.StatusCreated, group)
}

// HandleGroupRoutes routes group-related requests based on path and method
func (h *GroupHandler) HandleGroupRoutes(w http.ResponseWriter, r *http.Request) {
	// Extract group ID from path: /v1/groups/{id} or /v1/groups/{id}/favorite or /v1/groups/{id}/pinned
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	var groupID string
	var isFavoriteRoute bool
	var isPinnedRoute bool

	// Find "groups" in path and extract group ID
	for i, part := range pathParts {
		if part == "groups" && i+1 < len(pathParts) {
			groupID = pathParts[i+1]
			// Check if next part is "favorite" or "pinned"
			if i+2 < len(pathParts) {
				if pathParts[i+2] == "favorite" {
					isFavoriteRoute = true
				} else if pathParts[i+2] == "pinned" {
					isPinnedRoute = true
				}
			}
			break
		}
	}

	if groupID == "" {
		// Fallback to query parameter
		groupID = r.URL.Query().Get("id")
	}

	if groupID == "" {
		WriteError(w, fmt.Errorf("group ID required"), http.StatusBadRequest)
		return
	}

	// Route based on path and method
	if isFavoriteRoute {
		switch r.Method {
		case http.MethodPost:
			h.AddFavorite(w, r)
		case http.MethodDelete:
			h.RemoveFavorite(w, r)
		default:
			WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		}
		return
	}

	if isPinnedRoute {
		switch r.Method {
		case http.MethodGet:
			h.GetPinnedMessages(w, r)
		default:
			WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		}
		return
	}

	// Regular group routes
	switch r.Method {
	case http.MethodGet:
		h.GetGroup(w, r)
	case http.MethodPut, http.MethodPatch:
		h.UpdateGroup(w, r)
	default:
		WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
	}
}

// GetGroup handles GET /groups/{id}
func (h *GroupHandler) GetGroup(w http.ResponseWriter, r *http.Request) {
	// Extract group ID from path or query
	groupID := r.URL.Query().Get("id")
	if groupID == "" {
		pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		for i, part := range pathParts {
			if part == "groups" && i+1 < len(pathParts) {
				groupID = pathParts[i+1]
				break
			}
		}
	}
	if groupID == "" {
		WriteError(w, fmt.Errorf("group ID required"), http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	group, err := h.groupService.GetGroup(ctx, groupID)
	if err != nil {
		WriteError(w, err, http.StatusNotFound)
		return
	}

	WriteJSON(w, http.StatusOK, group)
}

// SuggestGroup handles GET /groups/suggest
func (h *GroupHandler) SuggestGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	// Extract query parameters
	latStr := r.URL.Query().Get("latitude")
	lonStr := r.URL.Query().Get("longitude")

	if latStr == "" || lonStr == "" {
		WriteError(w, fmt.Errorf("latitude and longitude are required"), http.StatusBadRequest)
		return
	}

	latitude, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		WriteError(w, fmt.Errorf("invalid latitude: %w", err), http.StatusBadRequest)
		return
	}

	longitude, err := strconv.ParseFloat(lonStr, 64)
	if err != nil {
		WriteError(w, fmt.Errorf("invalid longitude: %w", err), http.StatusBadRequest)
		return
	}

	// Validate latitude/longitude ranges
	if latitude < -90 || latitude > 90 {
		WriteError(w, fmt.Errorf("latitude must be between -90 and 90"), http.StatusBadRequest)
		return
	}
	if longitude < -180 || longitude > 180 {
		WriteError(w, fmt.Errorf("longitude must be between -180 and 180"), http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	req := service.GroupSuggestionRequest{
		Latitude:  latitude,
		Longitude: longitude,
	}

	suggestion, err := h.groupService.SuggestGroupNameAndType(ctx, req)
	if err != nil {
		WriteError(w, err, http.StatusInternalServerError)
		return
	}

	WriteJSON(w, http.StatusOK, suggestion)
}

// AddFavorite handles POST /groups/{id}/favorite
func (h *GroupHandler) AddFavorite(w http.ResponseWriter, r *http.Request) {
	// Get device ID from context
	ctx := r.Context()
	deviceID, ok := auth.GetDeviceIDFromContext(ctx)
	if !ok {
		WriteError(w, fmt.Errorf("unauthorized"), http.StatusUnauthorized)
		return
	}

	// Extract group ID from path
	groupID := extractGroupIDFromPath(r.URL.Path)
	if groupID == "" {
		WriteError(w, fmt.Errorf("group ID required"), http.StatusBadRequest)
		return
	}

	favorite, err := h.favoriteService.AddFavorite(ctx, deviceID, groupID)
	if err != nil {
		if strings.Contains(err.Error(), "already favorited") {
			// Already favorited, return existing
			WriteJSON(w, http.StatusOK, favorite)
			return
		}
		WriteError(w, err, http.StatusBadRequest)
		return
	}

	WriteJSON(w, http.StatusCreated, favorite)
}

// RemoveFavorite handles DELETE /groups/{id}/favorite
func (h *GroupHandler) RemoveFavorite(w http.ResponseWriter, r *http.Request) {
	// Get device ID from context
	ctx := r.Context()
	deviceID, ok := auth.GetDeviceIDFromContext(ctx)
	if !ok {
		WriteError(w, fmt.Errorf("unauthorized"), http.StatusUnauthorized)
		return
	}

	// Extract group ID from path
	groupID := extractGroupIDFromPath(r.URL.Path)
	if groupID == "" {
		WriteError(w, fmt.Errorf("group ID required"), http.StatusBadRequest)
		return
	}

	if err := h.favoriteService.RemoveFavorite(ctx, deviceID, groupID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			WriteError(w, err, http.StatusNotFound)
			return
		}
		WriteError(w, err, http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetGroupStatusSummary handles GET /groups/{id}/status-summary
func (h *GroupHandler) GetGroupStatusSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	// Extract group ID from path
	groupID := extractGroupIDFromPath(r.URL.Path)
	if groupID == "" {
		WriteError(w, fmt.Errorf("group ID required"), http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	summary, err := h.statusService.GetGroupStatusSummary(ctx, groupID)
	if err != nil {
		WriteError(w, err, http.StatusInternalServerError)
		return
	}

	WriteJSON(w, http.StatusOK, summary)
}

// GetPinnedMessages handles GET /groups/{id}/pinned
func (h *GroupHandler) GetPinnedMessages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		return
	}

	// Extract group ID from path
	groupID := extractGroupIDFromPath(r.URL.Path)
	if groupID == "" {
		WriteError(w, fmt.Errorf("group ID required"), http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	pins, err := h.pinService.GetPinnedMessages(ctx, groupID)
	if err != nil {
		WriteError(w, err, http.StatusInternalServerError)
		return
	}

	WriteJSON(w, http.StatusOK, pins)
}

// UpdateGroup handles PUT/PATCH /groups/{id}
func (h *GroupHandler) UpdateGroup(w http.ResponseWriter, r *http.Request) {
	// Get device ID from context
	ctx := r.Context()
	deviceID, ok := auth.GetDeviceIDFromContext(ctx)
	if !ok {
		WriteError(w, fmt.Errorf("unauthorized"), http.StatusUnauthorized)
		return
	}

	// Extract group ID from path
	groupID := extractGroupIDFromPath(r.URL.Path)
	if groupID == "" {
		WriteError(w, fmt.Errorf("group ID required"), http.StatusBadRequest)
		return
	}

	var req service.UpdateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
		return
	}

	group, err := h.groupService.UpdateGroup(ctx, groupID, deviceID, req)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			WriteError(w, err, http.StatusNotFound)
			return
		}
		if strings.Contains(err.Error(), "only the creator") {
			WriteError(w, err, http.StatusForbidden)
			return
		}
		WriteError(w, err, http.StatusBadRequest)
		return
	}

	WriteJSON(w, http.StatusOK, group)
}

// extractGroupIDFromPath extracts group ID from URL path
func extractGroupIDFromPath(path string) string {
	pathParts := strings.Split(strings.Trim(path, "/"), "/")
	for i, part := range pathParts {
		if part == "groups" && i+1 < len(pathParts) {
			return pathParts[i+1]
		}
	}
	return ""
}
