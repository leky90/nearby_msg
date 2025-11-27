package service

import (
	"context"
	"fmt"

	"nearby-msg/api/internal/domain"
	"nearby-msg/api/internal/infrastructure/database"
	"nearby-msg/api/internal/utils"
)

// FavoriteService handles favorite group business logic
type FavoriteService struct {
	repo *database.FavoriteRepository
}

// NewFavoriteService creates a new favorite service
func NewFavoriteService(repo *database.FavoriteRepository) *FavoriteService {
	return &FavoriteService{repo: repo}
}

// AddFavorite adds a group to device's favorites
func (s *FavoriteService) AddFavorite(ctx context.Context, deviceID, groupID string) (*domain.FavoriteGroup, error) {
	// Check if already favorited
	existing, err := s.repo.GetByDeviceAndGroup(ctx, deviceID, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing favorite: %w", err)
	}
	if existing != nil {
		return existing, nil // Already favorited, return existing
	}

	// Create new favorite
	favoriteID, err := utils.GenerateID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate favorite ID: %w", err)
	}

	favorite := &domain.FavoriteGroup{
		ID:       favoriteID,
		DeviceID: deviceID,
		GroupID:  groupID,
	}

	if err := s.repo.Create(ctx, favorite); err != nil {
		return nil, fmt.Errorf("failed to create favorite: %w", err)
	}

	return favorite, nil
}

// RemoveFavorite removes a group from device's favorites
func (s *FavoriteService) RemoveFavorite(ctx context.Context, deviceID, groupID string) error {
	if err := s.repo.Delete(ctx, deviceID, groupID); err != nil {
		return fmt.Errorf("failed to remove favorite: %w", err)
	}
	return nil
}

// GetFavorites retrieves all favorite groups for a device
func (s *FavoriteService) GetFavorites(ctx context.Context, deviceID string) ([]*domain.FavoriteGroup, error) {
	favorites, err := s.repo.GetByDeviceID(ctx, deviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get favorites: %w", err)
	}
	return favorites, nil
}

// IsFavorited checks if a device has favorited a group
func (s *FavoriteService) IsFavorited(ctx context.Context, deviceID, groupID string) (bool, error) {
	favorite, err := s.repo.GetByDeviceAndGroup(ctx, deviceID, groupID)
	if err != nil {
		return false, fmt.Errorf("failed to check favorite status: %w", err)
	}
	return favorite != nil, nil
}
