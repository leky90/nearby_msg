package domain

import (
	"errors"
	"fmt"
	"time"

	"nearby-msg/api/internal/utils"
)

var (
	ErrInvalidNickname = errors.New("nickname must be 1-50 characters and contain only alphanumeric characters, spaces, or hyphens")
)

// Device represents a user's installation of the app
type Device struct {
	ID        string    `json:"id"`
	Nickname  string    `json:"nickname"`
	PublicKey *string   `json:"public_key,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Validate validates device fields
func (d *Device) Validate() error {
	if err := ValidateNickname(d.Nickname); err != nil {
		return err
	}
	return nil
}

// ValidateNickname validates nickname format
func ValidateNickname(nickname string) error {
	if len(nickname) < 1 || len(nickname) > 50 {
		return ErrInvalidNickname
	}
	// Check for valid characters: alphanumeric, spaces, hyphens
	for _, r := range nickname {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == ' ' || r == '-') {
			return ErrInvalidNickname
		}
	}
	return nil
}

// GenerateRandomNickname generates a random nickname for new users
func GenerateRandomNickname() string {
	if id, err := utils.GenerateID(); err == nil && len(id) >= 6 {
		return "Neighbor-" + id[:6]
	}
	return fmt.Sprintf("Neighbor-%d", time.Now().UnixNano()%100000)
}
