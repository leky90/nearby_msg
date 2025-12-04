# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Enable GOTOOLCHAIN to auto-download required Go version
ENV GOTOOLCHAIN=auto

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
# CGO_ENABLED=0 creates a statically linked binary
# GOOS=linux ensures Linux compatibility
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/api ./cmd/server

# Runtime stage
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /

# Copy the binary from builder stage
COPY --from=builder /app/api /api

# Expose port
EXPOSE 8080

# Health check
# Note: Distroless images don't have curl or wget, so we can't do HTTP health checks directly
# The health check will verify the process is running
# Coolify or orchestration tools can handle HTTP health checks externally
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
#   CMD ["/api"] || exit 1

# Run the application
ENTRYPOINT ["/api"]

