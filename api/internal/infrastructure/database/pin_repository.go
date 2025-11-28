package database

import (
	"context"
	"errors"
	"time"

	"nearby-msg/api/internal/domain"

	"github.com/jackc/pgx/v5"
)

// PinRepository handles pinned message database operations
type PinRepository struct {
	pool *Pool
}

// NewPinRepository creates a new pin repository
func NewPinRepository(pool *Pool) *PinRepository {
	return &PinRepository{pool: pool}
}

// Create creates a new pinned message record
func (r *PinRepository) Create(ctx context.Context, pin *domain.PinnedMessage) error {
	query := `
		INSERT INTO pinned_messages (id, message_id, group_id, device_id, pinned_at, tag)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	now := time.Now()
	_, err := r.pool.Exec(ctx, query,
		pin.ID,
		pin.MessageID,
		pin.GroupID,
		pin.DeviceID,
		now,
		pin.Tag,
	)
	if err != nil {
		return err
	}
	pin.PinnedAt = now
	return nil
}

// Delete removes a pinned message record
func (r *PinRepository) Delete(ctx context.Context, deviceID, messageID string) error {
	query := `
		DELETE FROM pinned_messages
		WHERE device_id = $1 AND message_id = $2
	`
	result, err := r.pool.Exec(ctx, query, deviceID, messageID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return errors.New("pinned message not found")
	}
	return nil
}

// GetByGroupID retrieves all pinned messages for a group
func (r *PinRepository) GetByGroupID(ctx context.Context, groupID string) ([]*domain.PinnedMessage, error) {
	query := `
		SELECT id, message_id, group_id, device_id, pinned_at, tag
		FROM pinned_messages
		WHERE group_id = $1
		ORDER BY pinned_at DESC
	`
	rows, err := r.pool.Query(ctx, query, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pins []*domain.PinnedMessage
	for rows.Next() {
		var pin domain.PinnedMessage
		var tag *string
		if err := rows.Scan(
			&pin.ID,
			&pin.MessageID,
			&pin.GroupID,
			&pin.DeviceID,
			&pin.PinnedAt,
			&tag,
		); err != nil {
			return nil, err
		}
		pin.Tag = tag
		pins = append(pins, &pin)
	}

	return pins, rows.Err()
}

// GetByDeviceAndMessage checks if a device has pinned a specific message
func (r *PinRepository) GetByDeviceAndMessage(ctx context.Context, deviceID, messageID string) (*domain.PinnedMessage, error) {
	query := `
		SELECT id, message_id, group_id, device_id, pinned_at, tag
		FROM pinned_messages
		WHERE device_id = $1 AND message_id = $2
		LIMIT 1
	`
	var pin domain.PinnedMessage
	var tag *string
	err := r.pool.QueryRow(ctx, query, deviceID, messageID).Scan(
		&pin.ID,
		&pin.MessageID,
		&pin.GroupID,
		&pin.DeviceID,
		&pin.PinnedAt,
		&tag,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // Not pinned, not an error
		}
		return nil, err
	}
	pin.Tag = tag
	return &pin, nil
}

// GetPinsAfter retrieves pinned messages pinned after a given timestamp for a device
func (r *PinRepository) GetPinsAfter(ctx context.Context, deviceID string, since time.Time, limit int) ([]*domain.PinnedMessage, error) {
	query := `
		SELECT id, message_id, group_id, device_id, pinned_at, tag
		FROM pinned_messages
		WHERE device_id = $1 AND pinned_at > $2
		ORDER BY pinned_at ASC
		LIMIT $3
	`
	rows, err := r.pool.Query(ctx, query, deviceID, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pins []*domain.PinnedMessage
	for rows.Next() {
		var pin domain.PinnedMessage
		var tag *string
		if err := rows.Scan(
			&pin.ID,
			&pin.MessageID,
			&pin.GroupID,
			&pin.DeviceID,
			&pin.PinnedAt,
			&tag,
		); err != nil {
			return nil, err
		}
		pin.Tag = tag
		pins = append(pins, &pin)
	}

	return pins, rows.Err()
}
