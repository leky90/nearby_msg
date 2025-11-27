package auth

import (
	"context"
	"net/http"
	"strings"
)

// Context key for device ID
type contextKey string

const deviceIDKey contextKey = "device_id"

// AuthMiddleware validates JWT tokens and extracts device ID
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip auth for public endpoints
		if isPublicEndpoint(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		// Extract token from Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		// Check Bearer token format
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
			return
		}

		token := parts[1]

		// Validate token and extract device ID
		deviceID, err := ValidateToken(token)
		if err != nil {
			http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		// Add device ID to request context
		ctx := r.Context()
		ctx = context.WithValue(ctx, deviceIDKey, deviceID)
		r = r.WithContext(ctx)

		next.ServeHTTP(w, r)
	})
}

// isPublicEndpoint checks if an endpoint is public (doesn't require auth)
func isPublicEndpoint(path string) bool {
	publicPaths := []string{
		"/health",
		"/device/register",
	}
	for _, publicPath := range publicPaths {
		if path == publicPath || strings.HasPrefix(path, publicPath+"/") {
			return true
		}
	}
	return false
}

// GetDeviceIDFromContext extracts device ID from context
func GetDeviceIDFromContext(ctx context.Context) (string, bool) {
	deviceID, ok := ctx.Value(deviceIDKey).(string)
	return deviceID, ok
}
