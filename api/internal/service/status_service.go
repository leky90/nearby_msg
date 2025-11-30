package service

import (
	"context"
	"fmt"

	"nearby-msg/api/internal/domain"
	"nearby-msg/api/internal/infrastructure/database"
	"nearby-msg/api/internal/utils"
)

// StatusService handles user status business logic
type StatusService struct {
	repo *database.StatusRepository
}

// NewStatusService creates a new status service
func NewStatusService(repo *database.StatusRepository) *StatusService {
	return &StatusService{repo: repo}
}

// UpdateStatusRequest represents a status update request
type UpdateStatusRequest struct {
	StatusType  domain.StatusType `json:"status_type"`
	Description *string           `json:"description,omitempty"`
}

// UpdateStatus creates or updates a user's status
func (s *StatusService) UpdateStatus(ctx context.Context, deviceID string, req UpdateStatusRequest) (*domain.UserStatus, error) {
	// Check if status already exists
	existing, err := s.repo.GetByDeviceID(ctx, deviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing status: %w", err)
	}

	var statusID string
	if existing != nil {
		statusID = existing.ID
	} else {
		// Generate new ID
		statusID, err = utils.GenerateID()
		if err != nil {
			return nil, fmt.Errorf("failed to generate status ID: %w", err)
		}
	}

	status := &domain.UserStatus{
		ID:          statusID,
		DeviceID:    deviceID,
		StatusType:  req.StatusType,
		Description: req.Description,
	}

	if err := status.Validate(); err != nil {
		return nil, fmt.Errorf("status validation failed: %w", err)
	}

	if err := s.repo.Upsert(ctx, status); err != nil {
		return nil, fmt.Errorf("failed to update status: %w", err)
	}

	return status, nil
}

// GetStatus retrieves a user's status by device ID
func (s *StatusService) GetStatus(ctx context.Context, deviceID string) (*domain.UserStatus, error) {
	status, err := s.repo.GetByDeviceID(ctx, deviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get status: %w", err)
	}
	return status, nil
}

// GetGroupStatusSummary retrieves status summary for a group
func (s *StatusService) GetGroupStatusSummary(ctx context.Context, groupID string) (*database.StatusSummary, error) {
	summary, err := s.repo.GetGroupStatusSummary(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get status summary: %w", err)
	}
	return summary, nil
}
