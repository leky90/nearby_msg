package domain

import (
	"errors"
	"time"
)

var (
	ErrInvalidStatusType  = errors.New("invalid status type")
	ErrInvalidDescription = errors.New("description must be 1-200 characters if provided")
)

// StatusType represents a user's safety status
type StatusType string

const (
	StatusTypeSafe          StatusType = "safe"
	StatusTypeNeedHelp      StatusType = "need_help"
	StatusTypeCannotContact StatusType = "cannot_contact"
)

// UserStatus represents a user's current safety/need state
type UserStatus struct {
	ID          string     `json:"id"`
	DeviceID    string     `json:"device_id"`
	StatusType  StatusType `json:"status_type"`
	Description *string    `json:"description,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// Validate validates user status fields
func (us *UserStatus) Validate() error {
	if !us.StatusType.IsValid() {
		return ErrInvalidStatusType
	}
	if us.Description != nil {
		desc := *us.Description
		if len(desc) < 1 || len(desc) > 200 {
			return ErrInvalidDescription
		}
	}
	return nil
}

// IsValid checks if StatusType is valid
func (st StatusType) IsValid() bool {
	switch st {
	case StatusTypeSafe, StatusTypeNeedHelp, StatusTypeCannotContact:
		return true
	default:
		return false
	}
}
