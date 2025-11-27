package domain

import "time"

// FavoriteGroup represents a user's bookmark of a group
type FavoriteGroup struct {
	ID        string    `json:"id"`
	DeviceID  string    `json:"device_id"`
	GroupID   string    `json:"group_id"`
	CreatedAt time.Time `json:"created_at"`
}
