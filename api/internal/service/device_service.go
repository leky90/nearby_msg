package service

import (
	"context"
	"errors"
	"fmt"

	"nearby-msg/api/internal/domain"
	"nearby-msg/api/internal/infrastructure/database"
	"nearby-msg/api/internal/utils"
)

// DeviceService handles device business logic
type DeviceService struct {
	repo *database.DeviceRepository
}

// NewDeviceService creates a new device service
func NewDeviceService(repo *database.DeviceRepository) *DeviceService {
	return &DeviceService{repo: repo}
}

// RegisterDeviceRequest represents a device registration request
type RegisterDeviceRequest struct {
	ID       *string `json:"id,omitempty"`       // Optional, will be generated if not provided
	Nickname *string `json:"nickname,omitempty"` // Required - user must provide nickname
}

// RegisterDeviceResponse represents a device registration response
type RegisterDeviceResponse struct {
	Device *domain.Device `json:"device"`
	Token  string         `json:"token"`
}

// RegisterDevice registers a new device or returns existing device
func (s *DeviceService) RegisterDevice(ctx context.Context, req RegisterDeviceRequest) (*RegisterDeviceResponse, error) {
	var deviceID string
	var err error

	// Use provided ID or generate new one
	if req.ID != nil {
		deviceID = *req.ID
	} else {
		deviceID, err = utils.GenerateID()
		if err != nil {
			return nil, fmt.Errorf("failed to generate device ID: %w", err)
		}
	}

	// Check if device already exists
	existingDevice, err := s.repo.GetByID(ctx, deviceID)
	if err == nil && existingDevice != nil {
		// Device exists, return it (we'll generate a new token in the handler)
		return &RegisterDeviceResponse{
			Device: existingDevice,
		}, nil
	}

	// Nickname is required - must be provided by user
	if req.Nickname == nil || *req.Nickname == "" {
		return nil, errors.New("nickname is required")
	}
	nickname := *req.Nickname

	// Validate nickname
	if err := domain.ValidateNickname(nickname); err != nil {
		return nil, fmt.Errorf("nickname validation failed: %w", err)
	}

	// Create new device
	device := &domain.Device{
		ID:       deviceID,
		Nickname: nickname,
	}

	if err := device.Validate(); err != nil {
		return nil, fmt.Errorf("device validation failed: %w", err)
	}

	if err := s.repo.Create(ctx, device); err != nil {
		return nil, fmt.Errorf("failed to create device: %w", err)
	}

	return &RegisterDeviceResponse{
		Device: device,
	}, nil
}

// UpdateNickname updates a device's nickname
func (s *DeviceService) UpdateNickname(ctx context.Context, deviceID string, nickname string) error {
	if err := domain.ValidateNickname(nickname); err != nil {
		return fmt.Errorf("nickname validation failed: %w", err)
	}

	return s.repo.UpdateNickname(ctx, deviceID, nickname)
}

// GetDevice retrieves a device by ID
func (s *DeviceService) GetDevice(ctx context.Context, deviceID string) (*domain.Device, error) {
	device, err := s.repo.GetByID(ctx, deviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get device: %w", err)
	}
	return device, nil
}

// DeleteDevice deletes a device by ID
// Note: When a device is deleted, the database will automatically:
// - Set creator_device_id to NULL for any groups created by this device (via ON DELETE SET NULL)
// - Delete related records in other tables (user_status, favorite_groups, pinned_messages, messages) via CASCADE
// Groups created by the device will be preserved with creator_device_id = NULL
func (s *DeviceService) DeleteDevice(ctx context.Context, deviceID string) error {
	if err := s.repo.Delete(ctx, deviceID); err != nil {
		return fmt.Errorf("failed to delete device: %w", err)
	}
	return nil
}
