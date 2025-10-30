
# === Variables ===
PYTHON := python
UV := uv
APP_MODULE := app.main:app
PORT := 8010
COVERAGE_MIN := 80

# === Default Target ===
.DEFAULT_GOAL := help

# === PHONY Targets ===
.PHONY: help install install-dev lint lint-fix format format-check typecheck test test-unit test-integration test-fast coverage coverage-report security audit run run-prod dev dev-frontend dev-backend dev-compose dev-compose-bg dev-logs dev-stop clean clean-all build build-server build-slskd build-wizard buildx-server buildx-slskd buildx-wizard push push-server push-slskd push-wizard ci-lint ci-test ci-security ci setup

help: ## Show this help message
	@echo "🎵 NoisePort Server"
	@echo ""
	@echo "🚀 Quick Start:"
	@echo "  make setup          # Set up development environment"
	@echo "  make dev-compose    # Start hot reload development (recommended)"
	@echo ""
	@echo "🔥 Development (Hot Reload):"
	@echo "  make dev-compose    # Docker Compose with hot reload (frontend + backend)"
	@echo "  make dev-backend    # Backend only with hot reload"
	@echo "  make dev-frontend   # Frontend only with hot reload"
	@echo ""
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'


# === Setup & Install ===
install: ## Install production dependencies
	$(UV) sync --frozen

install-dev: ## Install development dependencies
	$(UV) sync --frozen --all-extras

setup: install-dev pre-commit-install build-wizard ## Set up development environment
	@echo "Development environment setup complete!"
	@echo "Setup wizard frontend built!"
	@echo "Run 'make dev' to start the development server"


# === Code Quality ===
lint: ## Run linting with ruff
	$(UV) run ruff check .

lint-fix: ## Run linting with auto-fix
	$(UV) run ruff check . --fix

format: ## Format code with ruff
	$(UV) run ruff format .

format-check: ## Check code formatting
	$(UV) run ruff format . --check

typecheck: ## Run type checking with mypy
	$(UV) run mypy app config


# === Testing & Coverage ===
test: ## Run all tests
	$(UV) run pytest

test-unit: ## Run unit tests only
	$(UV) run pytest -m "unit"

test-integration: ## Run integration tests only
	$(UV) run pytest -m "integration"

test-fast: ## Run tests excluding slow ones
	$(UV) run pytest -m "not slow"

coverage: ## Run tests with coverage
	$(UV) run pytest --cov=app --cov=config --cov-report=html --cov-report=term-missing --cov-fail-under=$(COVERAGE_MIN)

coverage-report: ## Generate coverage report
	$(UV) run coverage html
	@echo "Coverage report generated in htmlcov/index.html"


# === Security ===
security: ## Run security checks
	$(UV) run bandit -r app config

audit: ## Audit dependencies for vulnerabilities
	$(UV) run safety check

security-all: security audit ## Run all security checks


# === Application & Dev ===
run: ## Run the application in development mode
	$(UV) run uvicorn $(APP_MODULE) --reload --host 0.0.0.0 --port $(PORT)

run-prod: ## Run the application in production mode
	$(UV) run uvicorn $(APP_MODULE) --host 0.0.0.0 --port $(PORT) --workers 4

dev: ## Run development server with auto-reload
	$(UV) run fastapi dev app/main.py --port $(PORT)

dev-frontend: ## Start frontend in development mode with hot reload
	cd frontend && npm run dev -- --host 0.0.0.0 --port 3000

dev-backend: ## Start backend in development mode with hot reload
	$(UV) run uvicorn $(APP_MODULE) --reload --host 0.0.0.0 --port $(PORT)


dev-compose: ## Start both frontend and backend with Docker Compose and hot reload
	@echo "🚀 Starting development environment with hot reload..."
	@echo "📡 Services:"
	@echo "  Backend:  http://localhost:8000 (FastAPI + hot reload)"
	@echo "  Frontend: http://localhost:3000 (React + hot reload)"
	@echo "  Wizard:   http://localhost:3000"
	@echo ""
	@echo "✨ Both services will auto-reload on file changes!"
	@echo "🛑 Press Ctrl+C to stop all services"
	@echo ""
	docker compose -f docker-compose.dev.yml up --build

dev-compose-bg: ## Start development environment in background
	@echo "🚀 Starting development environment in background..."
	docker compose -f docker-compose.dev.yml up -d --build
	@echo "📡 Services started:"
	@echo "  Backend:  http://localhost:8000"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Wizard:   http://localhost:3000"
	@echo ""
	@echo "Run 'make dev-logs' to see logs"
	@echo "Run 'make dev-stop' to stop services"

dev-logs: ## View development logs
	docker compose -f docker-compose.dev.yml logs -f

dev-stop: ## Stop development environment
	docker compose -f docker-compose.dev.yml down

dev-full: ## Start both frontend and backend in development mode (requires 2 terminals)
	@echo "🚀 Development Mode Setup:"
	@echo ""
	@echo "🐳 Docker Compose (Recommended):"
	@echo "  make dev-compose      # Unified hot reload environment"
	@echo ""
	@echo "📦 Manual (2 terminals):"
	@echo "Terminal 1 - Backend with hot reload:"
	@echo "  make dev-backend"
	@echo ""
	@echo "Terminal 2 - Frontend with hot reload:"
	@echo "  make dev-frontend"
	@echo ""
	@echo "📡 Services:"
	@echo "  Backend:  http://localhost:$(PORT)"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Wizard:   http://localhost:3000"
	@echo ""
	@echo "✨ Both backend and frontend will auto-reload on changes!"


# === Docker Compose & Container ===
docker-build: ## Build Docker image
	docker build -t downloader:latest .

docker-run: ## Run Docker container
	docker run -p $(PORT):80 --env-file .env downloader:latest

docker-compose-up: ## Start services with docker-compose
	docker compose up -d

docker-compose-down: ## Stop services with docker-compose
	docker compose down

docker-logs: ## View docker-compose logs
	docker compose logs -f


# === Pre-commit ===
pre-commit-install: ## Install pre-commit hooks
	$(UV) run pre-commit install

pre-commit-run: ## Run pre-commit on all files
	$(UV) run pre-commit run --all-files

pre-commit-update: ## Update pre-commit hooks
	$(UV) run pre-commit autoupdate


# === Cleaning ===
clean: ## Clean up generated files
	rm -rf .coverage
	rm -rf htmlcov/
	rm -rf .pytest_cache/
	rm -rf .mypy_cache/
	rm -rf .ruff_cache/
	find . -type d -name "__pycache__" -delete
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete

clean-all: clean ## Clean up everything including venv
	rm -rf .venv/


# === CI/CD ===
ci-lint: ## CI linting
	$(UV) run ruff check .
	$(UV) run ruff format . --check
	$(UV) run mypy app config

ci-test: ## CI testing
	$(UV) run pytest --cov=app --cov=config --cov-report=xml --cov-fail-under=$(COVERAGE_MIN)

ci-security: ## CI security checks
	$(UV) run bandit -r app config -f json -o bandit-report.json
	$(UV) run safety check --json --output safety-report.json

ci: ci-lint ci-test ci-security ## Run all CI checks

# Database targets (for future use)
db-upgrade: ## Upgrade database schema
	@echo "Database upgrade not implemented yet"

db-downgrade: ## Downgrade database schema
	@echo "Database downgrade not implemented yet"

# Documentation targets
docs: ## Generate API documentation
	@echo "Opening API documentation at http://localhost:$(PORT)/docs"
	@echo "Start the server with 'make run' or 'make dev' first"

serve-docs: ## Serve documentation locally
	$(UV) run mkdocs serve


# === Build Targets ===
build: build-server build-slskd build-wizard ## Build all images (native)

build-server: ## Build noiseport-server image (native)
	docker build -t maxenceroux/noiseport-server:latest -f Dockerfile .

build-slskd: ## Build noiseport-server-slskd image (native)
	docker build -t maxenceroux/noiseport-server-slskd:latest -f Dockerfile.slskd .

build-wizard: ## Build noiseport-server-wizard image (native)
	docker build -t maxenceroux/noiseport-server-wizard:latest -f Dockerfile.wizard .

buildx-server: ## Build multi-arch noiseport-server image (amd64, arm64)
	docker buildx build --platform linux/amd64,linux/arm64 -t maxenceroux/noiseport-server:latest -f Dockerfile . --push

buildx-slskd: ## Build multi-arch noiseport-server-slskd image (amd64, arm64)
	docker buildx build --platform linux/amd64,linux/arm64 -t maxenceroux/noiseport-server-slskd:latest -f Dockerfile.slskd . --push

buildx-wizard: ## Build multi-arch noiseport-server-wizard image (amd64, arm64)
	docker buildx build --platform linux/amd64,linux/arm64 -t maxenceroux/noiseport-server-wizard:latest -f Dockerfile.wizard . --push

push: push-server push-slskd push-wizard ## Push all images

push-server:
	docker push maxenceroux/noiseport-server:latest

push-slskd:
	docker push maxenceroux/noiseport-server-slskd:latest

push-wizard:
	docker push maxenceroux/noiseport-server-wizard:latest

# Multi-arch Docker build and push
buildx-server: ## Build and push multi-arch noiseport-server image (amd64, arm64)
	docker buildx build --platform linux/amd64,linux/arm64 -t maxenceroux/noiseport-server:latest -f Dockerfile . --push

buildx-slskd: ## Build and push multi-arch noiseport-server-slskd image (amd64, arm64)
	docker buildx build --platform linux/amd64,linux/arm64 -t maxenceroux/noiseport-server-slskd:latest -f Dockerfile.slskd . --push

buildx-all: buildx-server buildx-slskd ## Build and push all multi-arch Docker images


# === Help Target ===
help: ## Show this help message
	@echo "🎵 Downloader API - Music Client Management"
	@echo ""
	@echo "🚀 Quick Start:"
	@echo "  make setup          # Set up development environment"
	@echo "  make build          # Build all Docker images"
	@echo "  make push           # Push all Docker images"
	@echo "  make lint           # Run linting"
	@echo "  make test           # Run all tests"
	@echo ""
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'