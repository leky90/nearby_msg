package domain

import (
	"errors"
	"time"
)

var (
	ErrInvalidGroupName = errors.New("group name must be 1-100 characters")
	ErrInvalidGroupType = errors.New("invalid group type")
	ErrInvalidLatitude  = errors.New("latitude must be between -90 and 90")
	ErrInvalidLongitude = errors.New("longitude must be between -180 and 180")
)

// GroupType represents the type of a group
type GroupType string

const (
	GroupTypeNeighborhood GroupType = "neighborhood"
	GroupTypeWard         GroupType = "ward"
	GroupTypeDistrict     GroupType = "district"
	GroupTypeApartment    GroupType = "apartment"
	GroupTypeOther        GroupType = "other"
)

// Group represents a community chat room for a geographic area
type Group struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Type            GroupType `json:"type"`
	Latitude        float64   `json:"latitude"`
	Longitude       float64   `json:"longitude"`
	RegionCode      *string   `json:"region_code,omitempty"`
	CreatorDeviceID string    `json:"creator_device_id"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// Validate validates group fields
func (g *Group) Validate() error {
	if len(g.Name) < 1 || len(g.Name) > 100 {
		return ErrInvalidGroupName
	}
	if !g.Type.IsValid() {
		return ErrInvalidGroupType
	}
	if g.Latitude < -90 || g.Latitude > 90 {
		return ErrInvalidLatitude
	}
	if g.Longitude < -180 || g.Longitude > 180 {
		return ErrInvalidLongitude
	}
	return nil
}

// IsValid checks if GroupType is valid
func (gt GroupType) IsValid() bool {
	switch gt {
	case GroupTypeNeighborhood, GroupTypeWard, GroupTypeDistrict, GroupTypeApartment, GroupTypeOther:
		return true
	default:
		return false
	}
}
