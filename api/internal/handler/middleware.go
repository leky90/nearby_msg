package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"runtime/debug"
	"strings"

	"nearby-msg/api/internal/infrastructure/auth"
	"nearby-msg/api/internal/infrastructure/logging"
)

// ErrorResponse represents a standardized error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
	Code    string `json:"code,omitempty"`
}

// ErrorHandlerMiddleware provides comprehensive error handling and recovery
func ErrorHandlerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				logger := logging.GetLogger()
				logger.Error("Panic recovered", "error", err, "stack", string(debug.Stack()))
				writeErrorResponse(w, http.StatusInternalServerError, "Internal server error", "INTERNAL_ERROR")
			}
		}()

		// Wrap response writer to capture status code
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rw, r)
	})
}

// Allowed frontend origins (HTTPS only in production)
var allowedOrigins = []string{
	"https://nearby-group.ldktech.com",
	// Development origins (can be adjusted or removed in production config)
	"http://localhost:5173",
	"http://localhost:4173",
}

// isOriginAllowed checks if Origin header is in the allowlist
func isOriginAllowed(origin string) bool {
	if origin == "" {
		return false
	}
	for _, o := range allowedOrigins {
		if strings.EqualFold(o, origin) {
			return true
		}
	}
	return false
}

// CORSMiddleware applies strict CORS policy:
// - Only allow specific origins (no "*")
// - Allow Authorization header for JWT-protected routes
// - Handle OPTIONS preflight requests
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if isOriginAllowed(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			// Allow credentials so JWT in Authorization header can be used
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}

		// Handle preflight requests early
		if r.Method == http.MethodOptions {
			// If origin is not allowed, just return 204 without CORS headers
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// writeErrorResponse writes a standardized error response
func writeErrorResponse(w http.ResponseWriter, statusCode int, message, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(ErrorResponse{
		Error:   message,
		Message: message,
		Code:    code,
	})
}

// WriteError writes an error response with appropriate status code
func WriteError(w http.ResponseWriter, err error, statusCode int) {
	code := "UNKNOWN_ERROR"
	message := err.Error()

	// Map common error patterns to error codes
	if statusCode == http.StatusBadRequest {
		code = "BAD_REQUEST"
	} else if statusCode == http.StatusUnauthorized {
		code = "UNAUTHORIZED"
	} else if statusCode == http.StatusForbidden {
		code = "FORBIDDEN"
	} else if statusCode == http.StatusNotFound {
		code = "NOT_FOUND"
	} else if statusCode == http.StatusConflict {
		code = "CONFLICT"
	} else if statusCode == http.StatusTooManyRequests {
		code = "RATE_LIMIT_EXCEEDED"
	} else if statusCode >= 500 {
		code = "INTERNAL_ERROR"
		// Don't expose internal error details in production
		message = "An internal error occurred"
		logger := logging.GetLogger()
		logger.Error("Internal error", "error", err, "statusCode", statusCode)
	}

	writeErrorResponse(w, statusCode, message, code)
}

// WriteJSON writes a JSON response
func WriteJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		logger := logging.GetLogger()
		logger.Error("Failed to encode JSON response", "error", err)
	}
}

// RequireMethod validates that the request uses the specified HTTP method
// Returns true if method matches, false otherwise (and writes error response)
func RequireMethod(w http.ResponseWriter, r *http.Request, method string) bool {
	if r.Method != method {
		WriteError(w, fmt.Errorf("method not allowed"), http.StatusMethodNotAllowed)
		return false
	}
	return true
}

// RequireAuth extracts device ID from context (set by auth middleware)
// Returns deviceID and true if authenticated, empty string and false otherwise (and writes error response)
func RequireAuth(w http.ResponseWriter, r *http.Request) (string, bool) {
	ctx := r.Context()
	deviceID, ok := auth.GetDeviceIDFromContext(ctx)
	if !ok {
		WriteError(w, fmt.Errorf("unauthorized"), http.StatusUnauthorized)
		return "", false
	}
	return deviceID, true
}

// DecodeJSON decodes request body JSON into the provided struct
// Returns error if decoding fails (and writes error response)
func DecodeJSON(w http.ResponseWriter, r *http.Request, v interface{}) error {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		WriteError(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
		return err
	}
	return nil
}
