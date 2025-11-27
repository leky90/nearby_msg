package database

import (
	"context"
	"errors"
	"time"

	"nearby-msg/api/internal/domain"

	"github.com/jackc/pgx/v5"
)

const (
	defaultMessageLimit   = 100
	defaultRetentionCount = 1000
	checkpointCollection  = "messages"
)

// MessageRepository handles persistence of chat messages and replication checkpoints.
type MessageRepository struct {
	pool *Pool
}

// NewMessageRepository creates a new message repository.
func NewMessageRepository(pool *Pool) *MessageRepository {
	return &MessageRepository{pool: pool}
}

// InsertMessages inserts multiple messages in a single transaction.
func (r *MessageRepository) InsertMessages(ctx context.Context, messages []*domain.Message) error {
	if len(messages) == 0 {
		return nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query := `
		INSERT INTO messages (
			id, group_id, device_id, content, message_type, sos_type,
			tags, pinned, created_at, device_sequence, synced_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11
		)
		ON CONFLICT (id) DO NOTHING
	`

	for _, msg := range messages {
		_, err := tx.Exec(ctx, query,
			msg.ID,
			msg.GroupID,
			msg.DeviceID,
			msg.Content,
			string(msg.MessageType),
			msg.SOSType,
			msg.Tags,
			msg.Pinned,
			msg.CreatedAt,
			msg.DeviceSequence,
			msg.SyncedAt,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// GetByID retrieves a message by ID
func (r *MessageRepository) GetByID(ctx context.Context, messageID string) (*domain.Message, error) {
	query := `
		SELECT id, group_id, device_id, content, message_type, sos_type,
		       tags, pinned, created_at, device_sequence, synced_at
		FROM messages
		WHERE id = $1
	`
	var msg domain.Message
	var messageType string
	var tags []string
	var deviceSequence *int
	var syncedAt *time.Time
	var sosType *domain.SOSType

	err := r.pool.QueryRow(ctx, query, messageID).Scan(
		&msg.ID,
		&msg.GroupID,
		&msg.DeviceID,
		&msg.Content,
		&messageType,
		&sosType,
		&tags,
		&msg.Pinned,
		&msg.CreatedAt,
		&deviceSequence,
		&syncedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("message not found")
		}
		return nil, err
	}

	msg.MessageType = domain.MessageType(messageType)
	msg.Tags = tags
	msg.DeviceSequence = deviceSequence
	msg.SOSType = sosType
	msg.SyncedAt = syncedAt
	return &msg, nil
}

// GetMessagesAfter returns messages created after the given timestamp.
func (r *MessageRepository) GetMessagesAfter(ctx context.Context, since time.Time, limit int) ([]*domain.Message, error) {
	if limit <= 0 || limit > 500 {
		limit = defaultMessageLimit
	}

	query := `
		SELECT id, group_id, device_id, content, message_type, sos_type,
		       tags, pinned, created_at, device_sequence, synced_at
		FROM messages
		WHERE created_at > $1
		ORDER BY created_at ASC, id ASC
		LIMIT $2
	`

	rows, err := r.pool.Query(ctx, query, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []*domain.Message
	for rows.Next() {
		var msg domain.Message
		var messageType string
		var tags []string
		var deviceSequence *int
		var syncedAt *time.Time
		var sosType *domain.SOSType

		if err := rows.Scan(
			&msg.ID,
			&msg.GroupID,
			&msg.DeviceID,
			&msg.Content,
			&messageType,
			&sosType,
			&tags,
			&msg.Pinned,
			&msg.CreatedAt,
			&deviceSequence,
			&syncedAt,
		); err != nil {
			return nil, err
		}

		msg.MessageType = domain.MessageType(messageType)
		msg.Tags = tags
		msg.DeviceSequence = deviceSequence
		msg.SOSType = sosType
		msg.SyncedAt = syncedAt
		messages = append(messages, &msg)
	}

	return messages, rows.Err()
}

// TrimOldMessages keeps the most recent maxMessages per group.
func (r *MessageRepository) TrimOldMessages(ctx context.Context, groupID string, maxMessages int) error {
	if maxMessages <= 0 {
		maxMessages = defaultRetentionCount
	}

	query := `
		DELETE FROM messages
		WHERE id IN (
			SELECT id FROM messages
			WHERE group_id = $1
			ORDER BY created_at DESC, id DESC
			OFFSET $2
		)
	`
	_, err := r.pool.Exec(ctx, query, groupID, maxMessages)
	return err
}

// GetCheckpoint returns the last checkpoint for a device and collection.
func (r *MessageRepository) GetCheckpoint(ctx context.Context, deviceID string) (time.Time, error) {
	query := `
		SELECT checkpoint
		FROM replication_checkpoints
		WHERE device_id = $1 AND collection = $2
	`
	var checkpoint time.Time
	err := r.pool.QueryRow(ctx, query, deviceID, checkpointCollection).Scan(&checkpoint)
	if err != nil {
		return time.Time{}, err
	}
	return checkpoint, nil
}

// UpsertCheckpoint updates the last checkpoint for a device and collection.
func (r *MessageRepository) UpsertCheckpoint(ctx context.Context, deviceID string, checkpoint time.Time) error {
	query := `
		INSERT INTO replication_checkpoints (device_id, collection, checkpoint)
		VALUES ($1, $2, $3)
		ON CONFLICT (device_id, collection)
		DO UPDATE SET checkpoint = EXCLUDED.checkpoint
	`
	_, err := r.pool.Exec(ctx, query, deviceID, checkpointCollection, checkpoint)
	return err
}
