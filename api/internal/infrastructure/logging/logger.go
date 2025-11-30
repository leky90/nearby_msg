package logging

import (
	"log/slog"
	"os"
)

var (
	// Logger is the global structured logger instance
	Logger *slog.Logger
)

// Init initializes the structured logger
// In production, use JSON handler. In development, use text handler.
func Init() {
	env := os.Getenv("ENV")
	if env == "production" || env == "prod" {
		// JSON handler for production (structured, searchable logs)
		opts := &slog.HandlerOptions{
			Level: slog.LevelInfo,
		}
		Logger = slog.New(slog.NewJSONHandler(os.Stdout, opts))
	} else {
		// Text handler for development (human-readable)
		opts := &slog.HandlerOptions{
			Level: slog.LevelDebug,
		}
		Logger = slog.New(slog.NewTextHandler(os.Stdout, opts))
	}
}

// GetLogger returns the global logger instance
// If not initialized, initializes with default settings
func GetLogger() *slog.Logger {
	if Logger == nil {
		Init()
	}
	return Logger
}
