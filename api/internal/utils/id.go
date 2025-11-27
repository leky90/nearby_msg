package utils

import (
	gonanoid "github.com/matoous/go-nanoid/v2"
)

const (
	// IDLength defines the default length for generated IDs
	IDLength = 21
)

// GenerateID creates a new NanoID-compatible identifier.
// It uses the default NanoID alphabet which is URL-safe.
func GenerateID() (string, error) {
	return gonanoid.New(IDLength)
}
