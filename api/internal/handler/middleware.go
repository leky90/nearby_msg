package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"runtime/debug"
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
				log.Printf("Panic recovered: %v\n%s", err, debug.Stack())
				writeErrorResponse(w, http.StatusInternalServerError, "Internal server error", "INTERNAL_ERROR")
			}
		}()

		// Wrap response writer to capture status code
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rw, r)
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
		log.Printf("Internal error: %v", err)
	}

	writeErrorResponse(w, statusCode, message, code)
}

// WriteJSON writes a JSON response
func WriteJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("Failed to encode JSON response: %v", err)
	}
}
