package database

import (
	"context"
	"errors"
	"strings"
	"time"

	"nearby-msg/api/internal/domain"

	"github.com/jackc/pgx/v5"
)

// FavoriteRepository handles favorite group database operations
type FavoriteRepository struct {
	pool *Pool
}

// NewFavoriteRepository creates a new favorite repository
func NewFavoriteRepository(pool *Pool) *FavoriteRepository {
	return &FavoriteRepository{pool: pool}
}

// Create creates a new favorite group record
func (r *FavoriteRepository) Create(ctx context.Context, favorite *domain.FavoriteGroup) error {
	query := `
		INSERT INTO favorite_groups (id, device_id, group_id, created_at)
		VALUES ($1, $2, $3, $4)
	`
	now := time.Now()
	_, err := r.pool.Exec(ctx, query,
		favorite.ID,
		favorite.DeviceID,
		favorite.GroupID,
		now,
	)
	if err != nil {
		// Check for unique constraint violation (PostgreSQL error code 23505)
		errStr := err.Error()
		if strings.Contains(errStr, "23505") || strings.Contains(errStr, "unique constraint") || strings.Contains(errStr, "duplicate key") {
			return errors.New("group is already favorited")
		}
		return err
	}
	favorite.CreatedAt = now
	return nil
}

// Delete removes a favorite group record
func (r *FavoriteRepository) Delete(ctx context.Context, deviceID, groupID string) error {
	query := `
		DELETE FROM favorite_groups
		WHERE device_id = $1 AND group_id = $2
	`
	result, err := r.pool.Exec(ctx, query, deviceID, groupID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return errors.New("favorite not found")
	}
	return nil
}

// GetByDeviceID retrieves all favorite groups for a device
func (r *FavoriteRepository) GetByDeviceID(ctx context.Context, deviceID string) ([]*domain.FavoriteGroup, error) {
	query := `
		SELECT id, device_id, group_id, created_at
		FROM favorite_groups
		WHERE device_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.pool.Query(ctx, query, deviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var favorites []*domain.FavoriteGroup
	for rows.Next() {
		var favorite domain.FavoriteGroup
		if err := rows.Scan(
			&favorite.ID,
			&favorite.DeviceID,
			&favorite.GroupID,
			&favorite.CreatedAt,
		); err != nil {
			return nil, err
		}
		favorites = append(favorites, &favorite)
	}

	return favorites, rows.Err()
}

// GetByDeviceAndGroup checks if a device has favorited a specific group
func (r *FavoriteRepository) GetByDeviceAndGroup(ctx context.Context, deviceID, groupID string) (*domain.FavoriteGroup, error) {
	query := `
		SELECT id, device_id, group_id, created_at
		FROM favorite_groups
		WHERE device_id = $1 AND group_id = $2
		LIMIT 1
	`
	var favorite domain.FavoriteGroup
	err := r.pool.QueryRow(ctx, query, deviceID, groupID).Scan(
		&favorite.ID,
		&favorite.DeviceID,
		&favorite.GroupID,
		&favorite.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // Not favorited, not an error
		}
		return nil, err
	}
	return &favorite, nil
}

// GetFavoritesAfter retrieves favorite groups created after a given timestamp for a device
func (r *FavoriteRepository) GetFavoritesAfter(ctx context.Context, deviceID string, since time.Time, limit int) ([]*domain.FavoriteGroup, error) {
	query := `
		SELECT id, device_id, group_id, created_at
		FROM favorite_groups
		WHERE device_id = $1 AND created_at > $2
		ORDER BY created_at ASC
		LIMIT $3
	`
	rows, err := r.pool.Query(ctx, query, deviceID, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var favorites []*domain.FavoriteGroup
	for rows.Next() {
		var favorite domain.FavoriteGroup
		if err := rows.Scan(
			&favorite.ID,
			&favorite.DeviceID,
			&favorite.GroupID,
			&favorite.CreatedAt,
		); err != nil {
			return nil, err
		}
		favorites = append(favorites, &favorite)
	}

	return favorites, rows.Err()
}
