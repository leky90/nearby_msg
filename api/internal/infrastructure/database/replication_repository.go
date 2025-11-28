package database

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// ReplicationRepository handles replication checkpoint operations for all collections
type ReplicationRepository struct {
	pool *Pool
}

// NewReplicationRepository creates a new replication repository
func NewReplicationRepository(pool *Pool) *ReplicationRepository {
	return &ReplicationRepository{pool: pool}
}

// GetCheckpoint returns the last checkpoint for a device and collection
func (r *ReplicationRepository) GetCheckpoint(ctx context.Context, deviceID string, collection string) (time.Time, error) {
	query := `
		SELECT checkpoint
		FROM replication_checkpoints
		WHERE device_id = $1 AND collection = $2
	`
	var checkpoint time.Time
	err := r.pool.QueryRow(ctx, query, deviceID, collection).Scan(&checkpoint)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return time.Time{}, errors.New("checkpoint not found")
		}
		return time.Time{}, err
	}
	return checkpoint, nil
}

// UpsertCheckpoint updates the last checkpoint for a device and collection
func (r *ReplicationRepository) UpsertCheckpoint(ctx context.Context, deviceID string, collection string, checkpoint time.Time) error {
	query := `
		INSERT INTO replication_checkpoints (device_id, collection, checkpoint)
		VALUES ($1, $2, $3)
		ON CONFLICT (device_id, collection)
		DO UPDATE SET checkpoint = EXCLUDED.checkpoint
	`
	_, err := r.pool.Exec(ctx, query, deviceID, collection, checkpoint)
	return err
}
