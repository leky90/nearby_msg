package database

import (
	"context"
	"errors"
	"math"
	"time"

	"nearby-msg/api/internal/domain"

	"github.com/jackc/pgx/v5"
)

// GroupRepository handles group database operations
type GroupRepository struct {
	pool *Pool
}

// NewGroupRepository creates a new group repository
func NewGroupRepository(pool *Pool) *GroupRepository {
	return &GroupRepository{pool: pool}
}

// Create creates a new group
func (r *GroupRepository) Create(ctx context.Context, group *domain.Group) error {
	query := `
		INSERT INTO groups (id, name, type, latitude, longitude, region_code, creator_device_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	now := time.Now()
	_, err := r.pool.Exec(ctx, query,
		group.ID,
		group.Name,
		string(group.Type),
		group.Latitude,
		group.Longitude,
		group.RegionCode,
		group.CreatorDeviceID,
		now,
		now,
	)
	if err != nil {
		return err
	}
	group.CreatedAt = now
	group.UpdatedAt = now
	return nil
}

// GetByID retrieves a group by ID
func (r *GroupRepository) GetByID(ctx context.Context, id string) (*domain.Group, error) {
	query := `
		SELECT id, name, type, latitude, longitude, region_code, creator_device_id, created_at, updated_at
		FROM groups
		WHERE id = $1
	`
	var group domain.Group
	var groupType string
	var regionCode *string
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&group.ID,
		&group.Name,
		&groupType,
		&group.Latitude,
		&group.Longitude,
		&regionCode,
		&group.CreatorDeviceID,
		&group.CreatedAt,
		&group.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("group not found")
		}
		return nil, err
	}
	group.Type = domain.GroupType(groupType)
	group.RegionCode = regionCode
	return &group, nil
}

// NearbyGroupResult represents a group with its distance from a point
type NearbyGroupResult struct {
	Group    *domain.Group
	Distance float64 // Distance in meters
}

// FindNearby finds groups within a radius of a given location
// Uses Haversine formula for distance calculation
func (r *GroupRepository) FindNearby(
	ctx context.Context,
	latitude float64,
	longitude float64,
	radiusMeters float64,
) ([]NearbyGroupResult, error) {
	// Calculate bounding box for initial filtering (more efficient than calculating distance for all groups)
	// Approximate: 1 degree latitude ≈ 111km, 1 degree longitude ≈ 111km * cos(latitude)
	latDelta := radiusMeters / 111000.0
	lonDelta := radiusMeters / (111000.0 * math.Cos(latitude*math.Pi/180.0))

	query := `
		SELECT id, name, type, latitude, longitude, region_code, creator_device_id, created_at, updated_at
		FROM groups
		WHERE latitude BETWEEN $1 AND $2
		  AND longitude BETWEEN $3 AND $4
		ORDER BY created_at DESC
	`

	minLat := latitude - latDelta
	maxLat := latitude + latDelta
	minLon := longitude - lonDelta
	maxLon := longitude + lonDelta

	rows, err := r.pool.Query(ctx, query, minLat, maxLat, minLon, maxLon)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []NearbyGroupResult
	for rows.Next() {
		var group domain.Group
		var groupType string
		var regionCode *string
		if err := rows.Scan(
			&group.ID,
			&group.Name,
			&groupType,
			&group.Latitude,
			&group.Longitude,
			&regionCode,
			&group.CreatorDeviceID,
			&group.CreatedAt,
			&group.UpdatedAt,
		); err != nil {
			return nil, err
		}
		group.Type = domain.GroupType(groupType)
		group.RegionCode = regionCode

		// Calculate exact distance using Haversine formula
		distance := calculateHaversineDistance(latitude, longitude, group.Latitude, group.Longitude)

		// Filter by exact radius
		if distance <= radiusMeters {
			results = append(results, NearbyGroupResult{
				Group:    &group,
				Distance: distance,
			})
		}
	}

	return results, rows.Err()
}

// calculateHaversineDistance calculates distance between two points using Haversine formula
func calculateHaversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371000 // Earth's radius in meters
	dLat := (lat2 - lat1) * math.Pi / 180.0
	dLon := (lon2 - lon1) * math.Pi / 180.0
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180.0)*math.Cos(lat2*math.Pi/180.0)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

// GetByCreatorDeviceID retrieves a group created by a device
func (r *GroupRepository) GetByCreatorDeviceID(ctx context.Context, deviceID string) (*domain.Group, error) {
	query := `
		SELECT id, name, type, latitude, longitude, region_code, creator_device_id, created_at, updated_at
		FROM groups
		WHERE creator_device_id = $1
		LIMIT 1
	`
	var group domain.Group
	var groupType string
	var regionCode *string
	err := r.pool.QueryRow(ctx, query, deviceID).Scan(
		&group.ID,
		&group.Name,
		&groupType,
		&group.Latitude,
		&group.Longitude,
		&regionCode,
		&group.CreatorDeviceID,
		&group.CreatedAt,
		&group.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // No group found, not an error
		}
		return nil, err
	}
	group.Type = domain.GroupType(groupType)
	group.RegionCode = regionCode
	return &group, nil
}

// UpdateName updates the name of a group
func (r *GroupRepository) UpdateName(ctx context.Context, id string, name string) error {
	query := `
		UPDATE groups
		SET name = $1, updated_at = $2
		WHERE id = $3
	`
	now := time.Now()
	result, err := r.pool.Exec(ctx, query, name, now, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return errors.New("group not found")
	}
	return nil
}

// GetGroupsAfter retrieves groups updated after a given timestamp
func (r *GroupRepository) GetGroupsAfter(ctx context.Context, since time.Time, limit int) ([]*domain.Group, error) {
	query := `
		SELECT id, name, type, latitude, longitude, region_code, creator_device_id, created_at, updated_at
		FROM groups
		WHERE updated_at > $1
		ORDER BY updated_at ASC
		LIMIT $2
	`
	rows, err := r.pool.Query(ctx, query, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []*domain.Group
	for rows.Next() {
		var group domain.Group
		var groupType string
		var regionCode *string
		if err := rows.Scan(
			&group.ID,
			&group.Name,
			&groupType,
			&group.Latitude,
			&group.Longitude,
			&regionCode,
			&group.CreatorDeviceID,
			&group.CreatedAt,
			&group.UpdatedAt,
		); err != nil {
			return nil, err
		}
		group.Type = domain.GroupType(groupType)
		group.RegionCode = regionCode
		groups = append(groups, &group)
	}

	return groups, rows.Err()
}
