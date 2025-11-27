#!/bin/bash
# Development script for running API in watch mode

set -e

# Check if air is installed
if ! command -v air &> /dev/null; then
    echo "❌ Air is not installed."
    echo "📦 Installing air..."
    go install github.com/air-verse/air@latest
    
    if ! command -v air &> /dev/null; then
        echo "❌ Failed to install air. Please install manually:"
        echo "   go install github.com/air-verse/air@latest"
        exit 1
    fi
    echo "✅ Air installed successfully!"
fi

echo "🚀 Starting API server in watch mode..."
echo "📝 Watching for changes in .go files..."
echo "🛑 Press Ctrl+C to stop"
echo ""

# Load .env file if it exists
if [ -f .env ]; then
  echo "📋 Loading environment variables from .env file..."
  export $(cat .env | grep -v '^#' | xargs)
fi

# Run air
air

