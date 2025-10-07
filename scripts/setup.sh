#!/bin/bash
set -e

echo "🚀 Setting up production-ready FastAPI development environment"

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "📦 Installing uv package manager..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    source $HOME/.cargo/env
fi

echo "📋 Installing dependencies..."
uv sync --all-extras

echo "🔧 Setting up pre-commit hooks..."
uv run pre-commit install

echo "🧪 Running initial tests..."
uv run pytest --tb=short

echo "✅ Setup complete! You can now:"
echo "  - Run development server: make dev"
echo "  - Run tests: make test"
echo "  - Run linting: make lint"
echo "  - See all commands: make help"
echo ""
echo "📖 Documentation available at http://localhost:8000/docs when running"