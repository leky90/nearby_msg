package database

import (
	"context"
	"errors"
	"time"

	"nearby-msg/api/internal/domain"

	"github.com/jackc/pgx/v5"
)

// StatusRepository handles user status database operations
type StatusRepository struct {
	pool *Pool
}

// NewStatusRepository creates a new status repository
func NewStatusRepository(pool *Pool) *StatusRepository {
	return &StatusRepository{pool: pool}
}

// Upsert creates or updates a user status
func (r *StatusRepository) Upsert(ctx context.Context, status *domain.UserStatus) error {
	query := `
		INSERT INTO user_status (id, device_id, status_type, description, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (device_id) 
		DO UPDATE SET 
			status_type = EXCLUDED.status_type,
			description = EXCLUDED.description,
			updated_at = EXCLUDED.updated_at
	`
	now := time.Now()
	if status.CreatedAt.IsZero() {
		status.CreatedAt = now
	}
	status.UpdatedAt = now

	_, err := r.pool.Exec(ctx, query,
		status.ID,
		status.DeviceID,
		string(status.StatusType),
		status.Description,
		status.CreatedAt,
		status.UpdatedAt,
	)
	if err != nil {
		return err
	}
	return nil
}

// GetByDeviceID retrieves a user status by device ID
func (r *StatusRepository) GetByDeviceID(ctx context.Context, deviceID string) (*domain.UserStatus, error) {
	query := `
		SELECT id, device_id, status_type, description, created_at, updated_at
		FROM user_status
		WHERE device_id = $1
		LIMIT 1
	`
	var status domain.UserStatus
	var statusType string
	var description *string
	err := r.pool.QueryRow(ctx, query, deviceID).Scan(
		&status.ID,
		&status.DeviceID,
		&statusType,
		&description,
		&status.CreatedAt,
		&status.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // No status found, not an error
		}
		return nil, err
	}
	status.StatusType = domain.StatusType(statusType)
	status.Description = description
	return &status, nil
}

// StatusSummary represents a summary of statuses in a group
type StatusSummary struct {
	SafeCount          int `json:"safe_count"`
	NeedHelpCount      int `json:"need_help_count"`
	CannotContactCount int `json:"cannot_contact_count"`
	TotalCount         int `json:"total_count"`
}

// GetGroupStatusSummary calculates status summary for devices in a group
// This is a simplified version - in production, you'd join with group_members or messages
// For now, we'll count statuses of devices that have sent messages in the group
func (r *StatusRepository) GetGroupStatusSummary(ctx context.Context, groupID string) (*StatusSummary, error) {
	// Get unique device IDs from messages in this group
	// Then count their statuses
	query := `
		WITH group_devices AS (
			SELECT DISTINCT device_id
			FROM messages
			WHERE group_id = $1
		)
		SELECT 
			COUNT(*) FILTER (WHERE us.status_type = 'safe') as safe_count,
			COUNT(*) FILTER (WHERE us.status_type = 'need_help') as need_help_count,
			COUNT(*) FILTER (WHERE us.status_type = 'cannot_contact') as cannot_contact_count,
			COUNT(*) as total_count
		FROM group_devices gd
		LEFT JOIN user_status us ON gd.device_id = us.device_id
	`
	var summary StatusSummary
	err := r.pool.QueryRow(ctx, query, groupID).Scan(
		&summary.SafeCount,
		&summary.NeedHelpCount,
		&summary.CannotContactCount,
		&summary.TotalCount,
	)
	if err != nil {
		return nil, err
	}
	return &summary, nil
}
