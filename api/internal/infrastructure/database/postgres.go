package database

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool represents a PostgreSQL connection pool
type Pool struct {
	*pgxpool.Pool
}

// NewPool creates a new PostgreSQL connection pool
func NewPool(ctx context.Context) (*Pool, error) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is not set")
	}

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Configure connection pool with optimized settings
	// MaxConns: Maximum number of connections (adjust based on server capacity)
	// For production, consider: CPU cores * 2 + effective_spindle_count
	maxConns := 25
	if envMaxConns := os.Getenv("DB_MAX_CONNS"); envMaxConns != "" {
		if parsed, err := fmt.Sscanf(envMaxConns, "%d", &maxConns); err == nil && parsed == 1 && maxConns > 0 {
			// Use environment variable if valid
		} else {
			maxConns = 25 // Fallback to default
		}
	}
	config.MaxConns = int32(maxConns)

	// MinConns: Minimum number of connections to maintain
	// Keep warm connections ready to reduce latency
	minConns := 5
	if envMinConns := os.Getenv("DB_MIN_CONNS"); envMinConns != "" {
		if parsed, err := fmt.Sscanf(envMinConns, "%d", &minConns); err == nil && parsed == 1 && minConns > 0 {
			// Use environment variable if valid
		} else {
			minConns = 5 // Fallback to default
		}
	}
	config.MinConns = int32(minConns)

	// MaxConnLifetime: Maximum time a connection can be reused
	// Helps prevent stale connections and database-side connection leaks
	config.MaxConnLifetime = time.Hour

	// MaxConnIdleTime: Maximum time a connection can be idle before being closed
	// Reduces resource usage during low-traffic periods
	config.MaxConnIdleTime = time.Minute * 30

	// HealthCheckPeriod: How often to check connection health
	// Helps detect and replace bad connections quickly
	config.HealthCheckPeriod = time.Minute

	// ConnConfig: Connection-level settings
	config.ConnConfig.ConnectTimeout = time.Second * 5
	config.ConnConfig.RuntimeParams["application_name"] = "nearby-msg-api"

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &Pool{Pool: pool}, nil
}

// Close closes the connection pool
func (p *Pool) Close() {
	if p.Pool != nil {
		p.Pool.Close()
	}
}
