package service

import (
	"context"
	"fmt"
	"sort"

	"nearby-msg/api/internal/domain"
	"nearby-msg/api/internal/infrastructure/database"
	"nearby-msg/api/internal/utils"
)

// GroupService handles group business logic
type GroupService struct {
	repo *database.GroupRepository
}

// NewGroupService creates a new group service
func NewGroupService(repo *database.GroupRepository) *GroupService {
	return &GroupService{repo: repo}
}

// CreateGroupRequest represents a group creation request
type CreateGroupRequest struct {
	Name            string           `json:"name"`
	Type            domain.GroupType `json:"type"`
	Latitude        float64          `json:"latitude"`
	Longitude       float64          `json:"longitude"`
	RegionCode      *string          `json:"region_code,omitempty"`
	CreatorDeviceID string           `json:"creator_device_id"`
}

// CreateGroup creates a new group
func (s *GroupService) CreateGroup(ctx context.Context, req CreateGroupRequest) (*domain.Group, error) {
	// Check if device already created a group
	existingGroup, err := s.repo.GetByCreatorDeviceID(ctx, req.CreatorDeviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing group: %w", err)
	}
	if existingGroup != nil {
		return nil, fmt.Errorf("device has already created a group")
	}

	// Create group
	groupID, err := utils.GenerateID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate group ID: %w", err)
	}

	group := &domain.Group{
		ID:              groupID,
		Name:            req.Name,
		Type:            req.Type,
		Latitude:        req.Latitude,
		Longitude:       req.Longitude,
		RegionCode:      req.RegionCode,
		CreatorDeviceID: req.CreatorDeviceID,
	}

	if err := group.Validate(); err != nil {
		return nil, err
	}

	if err := s.repo.Create(ctx, group); err != nil {
		return nil, fmt.Errorf("failed to create group: %w", err)
	}

	return group, nil
}

// ValidRadius represents valid radius values in meters
var ValidRadius = map[float64]bool{
	500:  true,
	1000: true,
	2000: true,
}

// ValidateRadius validates that radius is one of the allowed values
func ValidateRadius(radius float64) error {
	if !ValidRadius[radius] {
		return fmt.Errorf("invalid radius: must be 500, 1000, or 2000 meters")
	}
	return nil
}

// NearbyGroupsRequest represents a request to find nearby groups
type NearbyGroupsRequest struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Radius    float64 `json:"radius"` // in meters: 500, 1000, or 2000
}

// NearbyGroupResponse represents a nearby group with distance and activity
type NearbyGroupResponse struct {
	Group    *domain.Group `json:"group"`
	Distance float64       `json:"distance"` // in meters
	Activity int           `json:"activity"` // message count in last 24 hours (simplified)
}

// FindNearbyGroups finds groups within a radius and calculates activity
func (s *GroupService) FindNearbyGroups(ctx context.Context, req NearbyGroupsRequest) ([]NearbyGroupResponse, error) {
	// Validate radius
	if err := ValidateRadius(req.Radius); err != nil {
		return nil, err
	}

	// Find nearby groups
	results, err := s.repo.FindNearby(ctx, req.Latitude, req.Longitude, req.Radius)
	if err != nil {
		return nil, fmt.Errorf("failed to find nearby groups: %w", err)
	}

	// Sort by distance
	sort.Slice(results, func(i, j int) bool {
		return results[i].Distance < results[j].Distance
	})

	// Convert to response format with activity
	responses := make([]NearbyGroupResponse, len(results))
	for i, result := range results {
		// TODO: Calculate actual activity (message count in last 24h)
		// For now, return 0 as placeholder
		activity := 0
		responses[i] = NearbyGroupResponse{
			Group:    result.Group,
			Distance: result.Distance,
			Activity: activity,
		}
	}

	return responses, nil
}

// GetGroup retrieves a group by ID
func (s *GroupService) GetGroup(ctx context.Context, groupID string) (*domain.Group, error) {
	group, err := s.repo.GetByID(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group: %w", err)
	}

	return group, nil
}

// UpdateGroupRequest represents a group update request
type UpdateGroupRequest struct {
	Name string `json:"name"`
}

// UpdateGroup updates a group (only name for now)
func (s *GroupService) UpdateGroup(ctx context.Context, groupID string, deviceID string, req UpdateGroupRequest) (*domain.Group, error) {
	// Get the group first
	group, err := s.repo.GetByID(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group: %w", err)
	}

	// Check if the device is the creator
	if group.CreatorDeviceID != deviceID {
		return nil, fmt.Errorf("only the creator can update the group")
	}

	// Validate new name
	if len(req.Name) < 1 || len(req.Name) > 100 {
		return nil, domain.ErrInvalidGroupName
	}

	// Update the name
	if err := s.repo.UpdateName(ctx, groupID, req.Name); err != nil {
		return nil, fmt.Errorf("failed to update group: %w", err)
	}

	// Return updated group
	updatedGroup, err := s.repo.GetByID(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get updated group: %w", err)
	}

	return updatedGroup, nil
}

// GroupSuggestionRequest represents a request for group name/type suggestions
type GroupSuggestionRequest struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// GroupSuggestionResponse represents suggested group name and type
type GroupSuggestionResponse struct {
	SuggestedName string           `json:"suggested_name"`
	SuggestedType domain.GroupType `json:"suggested_type"`
}

// SuggestGroupNameAndType suggests a group name and type based on location
// This is a simplified implementation - in production, you might use reverse geocoding APIs
func (s *GroupService) SuggestGroupNameAndType(ctx context.Context, req GroupSuggestionRequest) (*GroupSuggestionResponse, error) {
	// Check for nearby groups to infer type
	nearbyReq := NearbyGroupsRequest{
		Latitude:  req.Latitude,
		Longitude: req.Longitude,
		Radius:    2000, // Check within 2km
	}

	nearbyGroups, err := s.FindNearbyGroups(ctx, nearbyReq)
	if err != nil {
		// If error, default to "other" type
		return &GroupSuggestionResponse{
			SuggestedName: "Community Group",
			SuggestedType: domain.GroupTypeOther,
		}, nil
	}

	// If there are nearby groups, suggest the most common type
	if len(nearbyGroups) > 0 {
		typeCount := make(map[domain.GroupType]int)
		for _, group := range nearbyGroups {
			typeCount[group.Group.Type]++
		}

		// Find most common type
		maxCount := 0
		var suggestedType domain.GroupType = domain.GroupTypeOther
		for groupType, count := range typeCount {
			if count > maxCount {
				maxCount = count
				suggestedType = groupType
			}
		}

		// Generate name based on type
		suggestedName := generateGroupName(suggestedType, req.Latitude, req.Longitude)

		return &GroupSuggestionResponse{
			SuggestedName: suggestedName,
			SuggestedType: suggestedType,
		}, nil
	}

	// No nearby groups - default suggestion
	// In production, use reverse geocoding to get actual location name
	return &GroupSuggestionResponse{
		SuggestedName: "Community Group",
		SuggestedType: domain.GroupTypeVillage,
	}, nil
}

// generateGroupName generates a group name based on type and coordinates
// This is a simplified implementation - in production, use reverse geocoding
func generateGroupName(groupType domain.GroupType, lat, lon float64) string {
	// Use coordinates to create a simple identifier
	// Format: "Type - {lat},{lon}" (rounded to 4 decimal places)
	latStr := fmt.Sprintf("%.4f", lat)
	lonStr := fmt.Sprintf("%.4f", lon)

	typeLabel := map[domain.GroupType]string{
		domain.GroupTypeVillage:          "Village",
		domain.GroupTypeHamlet:           "Hamlet",
		domain.GroupTypeResidentialGroup: "Residential Group",
		domain.GroupTypeStreetBlock:      "Street Block",
		domain.GroupTypeWard:             "Ward",
		domain.GroupTypeCommune:          "Commune",
		domain.GroupTypeApartment:        "Apartment",
		domain.GroupTypeResidentialArea:  "Residential Area",
		domain.GroupTypeOther:            "Community",
	}

	label := typeLabel[groupType]
	if label == "" {
		label = "Community"
	}

	return fmt.Sprintf("%s - %s,%s", label, latStr, lonStr)
}
