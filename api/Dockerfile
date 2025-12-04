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

# Ứng dụng được build với đường dẫn runtime.Caller() trỏ về /app/...
# nên cần copy cả thư mục migrations vào đúng path /app/internal/...
WORKDIR /app

# Copy binary và migrations từ builder stage
COPY --from=builder /app/api ./api
COPY --from=builder /app/internal/infrastructure/database/migrations ./internal/infrastructure/database/migrations

# Expose port
EXPOSE 8080

# Run the application
ENTRYPOINT ["/app/api"]
