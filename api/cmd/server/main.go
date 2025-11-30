package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"syscall"
	"time"

	"nearby-msg/api/internal/handler"
	"nearby-msg/api/internal/infrastructure/auth"
	"nearby-msg/api/internal/infrastructure/database"
	"nearby-msg/api/internal/infrastructure/logging"
	"nearby-msg/api/internal/service"

	"github.com/joho/godotenv"
)

func main() {
	// Initialize structured logger
	logging.Init()
	logger := logging.GetLogger()

	// Load .env file if it exists (for development)
	// In production, environment variables should be set by the deployment platform
	if err := godotenv.Load(); err != nil {
		// .env file is optional - environment variables can be set directly
		logger.Info("Note: .env file not found, using environment variables")
	}

	ctx := context.Background()

	// Initialize database connection pool
	dbPool, err := database.NewPool(ctx)
	if err != nil {
		logger.Error("Failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer dbPool.Close()

	// Run migrations
	if err := runMigrations(ctx, dbPool); err != nil {
		logger.Error("Failed to run migrations", "error", err)
		os.Exit(1)
	}

	// Initialize repositories
	deviceRepo := database.NewDeviceRepository(dbPool)
	groupRepo := database.NewGroupRepository(dbPool)
	messageRepo := database.NewMessageRepository(dbPool)
	favoriteRepo := database.NewFavoriteRepository(dbPool)
	statusRepo := database.NewStatusRepository(dbPool)
	pinRepo := database.NewPinRepository(dbPool)
	replicationRepo := database.NewReplicationRepository(dbPool)

	// Initialize services
	deviceService := service.NewDeviceService(deviceRepo)
	groupService := service.NewGroupService(groupRepo)
	messageService := service.NewMessageService(messageRepo)
	favoriteService := service.NewFavoriteService(favoriteRepo)
	statusService := service.NewStatusService(statusRepo)
	pinService := service.NewPinService(pinRepo, messageRepo)
	replicationService := service.NewReplicationService(
		messageRepo,
		groupRepo,
		favoriteRepo,
		pinRepo,
		statusRepo,
		replicationRepo,
		messageService,
		groupService,
		favoriteService,
		statusService,
		deviceService,
	)

	// Initialize handlers
	deviceHandler := handler.NewDeviceHandler(deviceService)
	groupHandler := handler.NewGroupHandler(groupService, favoriteService, statusService, pinService)
	replicationHandler := handler.NewReplicationHandler(replicationService)
	statusHandler := handler.NewStatusHandler(statusService)
	messageHandler := handler.NewMessageHandler(pinService)

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Check if port is available
	if !isPortAvailable(port) {
		logger.Warn("Port is already in use", "port", port)
		// Try to find PID using the port
		if pid := findProcessUsingPort(port); pid != "" {
			logger.Warn("Port is being used by process", "port", port, "pid", pid)
			logger.Info("To free the port, run", "command", fmt.Sprintf("kill -9 %s", pid))
		}
		logger.Error("Cannot start server: port is already in use", "port", port)
		os.Exit(1)
	}

	// Create HTTP server with error handling middleware
	mux := http.NewServeMux()

	// Wrap all handlers with error handling middleware
	errorHandler := handler.ErrorHandlerMiddleware

	// Health check endpoint (no error middleware needed)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// API v1 routes with error handling middleware
	mux.Handle("/v1/device/register", errorHandler(http.HandlerFunc(deviceHandler.RegisterDevice)))
	mux.Handle("/v1/device", errorHandler(http.HandlerFunc(deviceHandler.GetDevice)))
	mux.Handle("/v1/device/", errorHandler(http.HandlerFunc(deviceHandler.UpdateDevice)))

	// Group routes
	mux.Handle("/v1/groups/nearby", errorHandler(http.HandlerFunc(groupHandler.GetNearbyGroups)))
	mux.Handle("/v1/groups/suggest", errorHandler(http.HandlerFunc(groupHandler.SuggestGroup)))
	mux.Handle("/v1/groups", errorHandler(auth.AuthMiddleware(http.HandlerFunc(groupHandler.CreateGroup))))
	// Group and favorite routes (handler will route based on path and method)
	mux.Handle("/v1/groups/", errorHandler(auth.AuthMiddleware(http.HandlerFunc(groupHandler.HandleGroupRoutes))))

	// Replication routes
	mux.Handle("/v1/replicate/push", errorHandler(auth.AuthMiddleware(http.HandlerFunc(replicationHandler.Push))))
	mux.Handle("/v1/replicate/pull", errorHandler(auth.AuthMiddleware(http.HandlerFunc(replicationHandler.Pull))))

	// Message routes (pin/unpin)
	mux.Handle("/v1/messages/", errorHandler(auth.AuthMiddleware(http.HandlerFunc(messageHandler.HandleMessageRoutes))))

	// Status routes
	mux.Handle("/v1/status", errorHandler(auth.AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPut {
			statusHandler.UpdateStatus(w, r)
		} else if r.Method == http.MethodGet {
			statusHandler.GetStatus(w, r)
		} else {
			handler.WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		}
	}))))
	// Group status summary route (must be before /v1/groups/ to avoid conflict)
	mux.Handle("/v1/groups/status-summary", errorHandler(auth.AuthMiddleware(http.HandlerFunc(groupHandler.GetGroupStatusSummary))))

	server := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	// Start server in a goroutine
	go func() {
		logger.Info("Server starting", "port", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("Server failed to start", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("Server forced to shutdown", "error", err)
		os.Exit(1)
	}

	logger.Info("Server exited")
}

// runMigrations executes database migrations in order
func runMigrations(ctx context.Context, pool *database.Pool) error {
	logger := logging.GetLogger()
	// Get migrations directory path relative to this file
	_, currentFile, _, _ := runtime.Caller(0)
	baseDir := filepath.Dir(currentFile)
	migrationsDir := filepath.Join(baseDir, "../../internal/infrastructure/database/migrations")
	migrationsDir, err := filepath.Abs(migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to resolve migrations directory: %w", err)
	}

	// Read migration files from filesystem
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	// Filter and sort migration files
	var migrationFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			migrationFiles = append(migrationFiles, entry.Name())
		}
	}
	sort.Strings(migrationFiles)

	// Execute each migration
	for _, filename := range migrationFiles {
		migrationPath := filepath.Join(migrationsDir, filename)
		migrationSQL, err := os.ReadFile(migrationPath)
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", filename, err)
		}

		logger.Info("Running migration", "filename", filename)
		if _, err := pool.Exec(ctx, string(migrationSQL)); err != nil {
			// Ignore errors for existing objects (tables, indexes, triggers, functions)
			errStr := err.Error()
			if strings.Contains(errStr, "already exists") ||
				strings.Contains(errStr, "duplicate") ||
				strings.Contains(errStr, "SQLSTATE 42710") {
				logger.Info("Migration: objects already exist, skipping", "filename", filename)
				continue
			}
			return fmt.Errorf("failed to execute migration %s: %w", filename, err)
		}
		logger.Info("Migration completed", "filename", filename)
	}

	return nil
}

// isPortAvailable checks if a port is available for binding
func isPortAvailable(port string) bool {
	ln, err := net.Listen("tcp", ":"+port)
	if err != nil {
		return false
	}
	ln.Close()
	return true
}

// findProcessUsingPort attempts to find the PID of the process using the port
func findProcessUsingPort(port string) string {
	cmd := exec.Command("lsof", "-ti", ":"+port)
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	pid := strings.TrimSpace(string(output))
	if pid != "" {
		return pid
	}
	return ""
}
