package database

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"nearby-msg/api/internal/domain"
)

// DeviceRepository handles device database operations
type DeviceRepository struct {
	pool *Pool
}

// NewDeviceRepository creates a new device repository
func NewDeviceRepository(pool *Pool) *DeviceRepository {
	return &DeviceRepository{pool: pool}
}

// Create creates a new device
func (r *DeviceRepository) Create(ctx context.Context, device *domain.Device) error {
	query := `
		INSERT INTO devices (id, nickname, public_key, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
	`
	now := time.Now()
	_, err := r.pool.Exec(ctx, query,
		device.ID,
		device.Nickname,
		device.PublicKey,
		now,
		now,
	)
	if err != nil {
		return err
	}
	device.CreatedAt = now
	device.UpdatedAt = now
	return nil
}

// GetByID retrieves a device by ID
func (r *DeviceRepository) GetByID(ctx context.Context, id string) (*domain.Device, error) {
	query := `
		SELECT id, nickname, public_key, created_at, updated_at
		FROM devices
		WHERE id = $1
	`
	var device domain.Device
	var publicKey *string
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&device.ID,
		&device.Nickname,
		&publicKey,
		&device.CreatedAt,
		&device.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("device not found")
		}
		return nil, err
	}
	device.PublicKey = publicKey
	return &device, nil
}

// UpdateNickname updates a device's nickname
func (r *DeviceRepository) UpdateNickname(ctx context.Context, id string, nickname string) error {
	query := `
		UPDATE devices
		SET nickname = $1, updated_at = NOW()
		WHERE id = $2
	`
	result, err := r.pool.Exec(ctx, query, nickname, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return errors.New("device not found")
	}
	return nil
}
