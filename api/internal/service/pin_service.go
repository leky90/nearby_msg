package service

import (
	"context"
	"fmt"

	"nearby-msg/api/internal/domain"
	"nearby-msg/api/internal/infrastructure/database"
	"nearby-msg/api/internal/utils"
)

// PinService handles pinned message business logic
type PinService struct {
	pinRepo     *database.PinRepository
	messageRepo *database.MessageRepository
}

// NewPinService creates a new pin service
func NewPinService(pinRepo *database.PinRepository, messageRepo *database.MessageRepository) *PinService {
	return &PinService{
		pinRepo:     pinRepo,
		messageRepo: messageRepo,
	}
}

// PinMessage pins a message for a device
func (s *PinService) PinMessage(ctx context.Context, deviceID, messageID string, tag *string) (*domain.PinnedMessage, error) {
	// Check if already pinned by this device
	existing, err := s.pinRepo.GetByDeviceAndMessage(ctx, deviceID, messageID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing pin: %w", err)
	}
	if existing != nil {
		return existing, nil // Already pinned, return existing
	}

	// Get message to extract group_id
	message, err := s.messageRepo.GetByID(ctx, messageID)
	if err != nil {
		return nil, fmt.Errorf("failed to get message: %w", err)
	}
	if message == nil {
		return nil, fmt.Errorf("message not found")
	}
	groupID := message.GroupID

	// Create new pin
	pinID, err := utils.GenerateID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate pin ID: %w", err)
	}

	pin := &domain.PinnedMessage{
		ID:        pinID,
		MessageID: messageID,
		GroupID:   groupID,
		DeviceID:  deviceID,
		Tag:       tag,
	}

	if err := s.pinRepo.Create(ctx, pin); err != nil {
		return nil, fmt.Errorf("failed to create pin: %w", err)
	}

	return pin, nil
}

// UnpinMessage unpins a message for a device
func (s *PinService) UnpinMessage(ctx context.Context, deviceID, messageID string) error {
	if err := s.pinRepo.Delete(ctx, deviceID, messageID); err != nil {
		return fmt.Errorf("failed to remove pin: %w", err)
	}
	return nil
}

// GetPinnedMessages retrieves all pinned messages for a group
func (s *PinService) GetPinnedMessages(ctx context.Context, groupID string) ([]*domain.PinnedMessage, error) {
	pins, err := s.pinRepo.GetByGroupID(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get pinned messages: %w", err)
	}
	return pins, nil
}

// IsPinned checks if a device has pinned a message
func (s *PinService) IsPinned(ctx context.Context, deviceID, messageID string) (bool, error) {
	pin, err := s.pinRepo.GetByDeviceAndMessage(ctx, deviceID, messageID)
	if err != nil {
		return false, fmt.Errorf("failed to check pin status: %w", err)
	}
	return pin != nil, nil
}

