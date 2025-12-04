package domain

import (
	"errors"
	"time"
)

var (
	ErrInvalidMessageContent = errors.New("message content must be 1-2048 characters")
	ErrInvalidMessageType    = errors.New("invalid message type")
	ErrInvalidSOSType        = errors.New("invalid SOS type")
	ErrSOSTypeRequired       = errors.New("SOS type is required for SOS messages")
)

// MessageType represents the type of a message
type MessageType string

const (
	MessageTypeText         MessageType = "text"
	MessageTypeSOS          MessageType = "sos"
	MessageTypeStatusUpdate MessageType = "status_update"
)

// SOSType represents the type of SOS emergency
type SOSType string

const (
	SOSTypeMedical       SOSType = "medical"
	SOSTypeFlood         SOSType = "flood"
	SOSTypeFire          SOSType = "fire"
	SOSTypeMissingPerson SOSType = "missing_person"
)

// Message represents a communication within a group
type Message struct {
	ID             string      `json:"id"`
	GroupID        string      `json:"group_id"`
	DeviceID       string      `json:"device_id"`
	Content        string      `json:"content"`
	MessageType    MessageType `json:"message_type"`
	SOSType        *SOSType    `json:"sos_type,omitempty"`
	Tags           []string    `json:"tags,omitempty"`
	Pinned         bool        `json:"pinned"`
	CreatedAt      time.Time   `json:"created_at"`
	DeviceSequence *int        `json:"device_sequence,omitempty"`
	SyncedAt       *time.Time  `json:"synced_at,omitempty"`
}

// Validate validates message fields
func (m *Message) Validate() error {
	// Basic content length guard (1–2048 characters, ~2KB max)
	if len(m.Content) < 1 || len(m.Content) > 2048 {
		return ErrInvalidMessageContent
	}
	// Basic group and device validation
	if m.GroupID == "" {
		return errors.New("group_id is required")
	}
	if m.DeviceID == "" {
		return errors.New("device_id is required")
	}

	// Validate tags: limit count and length
	if len(m.Tags) > 16 {
		return errors.New("too many tags (max 16)")
	}
	for _, tag := range m.Tags {
		if len(tag) == 0 {
			return errors.New("tag cannot be empty")
		}
		if len(tag) > 64 {
			return errors.New("tag too long (max 64 characters)")
		}
	}

	if !m.MessageType.IsValid() {
		return ErrInvalidMessageType
	}
	if m.MessageType == MessageTypeSOS {
		if m.SOSType == nil {
			return ErrSOSTypeRequired
		}
		if !m.SOSType.IsValid() {
			return ErrInvalidSOSType
		}
	} else if m.SOSType != nil {
		return errors.New("SOS type should only be set for SOS messages")
	}
	return nil
}

// IsValid checks if MessageType is valid
func (mt MessageType) IsValid() bool {
	switch mt {
	case MessageTypeText, MessageTypeSOS, MessageTypeStatusUpdate:
		return true
	default:
		return false
	}
}

// IsValid checks if SOSType is valid
func (st SOSType) IsValid() bool {
	switch st {
	case SOSTypeMedical, SOSTypeFlood, SOSTypeFire, SOSTypeMissingPerson:
		return true
	default:
		return false
	}
}
