package domain

import "time"

// PinnedMessage represents a message marked as important within a group
type PinnedMessage struct {
	ID        string    `json:"id"`
	MessageID string    `json:"message_id"`
	GroupID   string    `json:"group_id"`
	DeviceID  string    `json:"device_id"`
	PinnedAt  time.Time `json:"pinned_at"`
	Tag       *string   `json:"tag,omitempty"`
}
