.PHONY: help dev build run test clean watch

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

dev: ## Run server in watch mode (requires air)
	@if command -v air > /dev/null; then \
		air; \
	else \
		echo "Error: air is not installed. Install it with: go install github.com/cosmtrek/air@latest"; \
		exit 1; \
	fi

build: ## Build the server binary
	@go build -o bin/server ./cmd/server

run: ## Run the server directly
	@go run ./cmd/server

test: ## Run tests
	@go test ./...

test-verbose: ## Run tests with verbose output
	@go test -v ./...

test-coverage: ## Run tests with coverage
	@go test -cover ./...

clean: ## Clean build artifacts
	@rm -rf bin/ tmp/
	@go clean

watch: dev ## Alias for dev (watch mode)

install-air: ## Install air for watch mode
	@go install github.com/air-verse/air@latest
	@echo "Air installed successfully. Run 'make dev' to start watch mode."

