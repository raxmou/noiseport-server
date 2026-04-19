PYTHON := python
UV := uv
APP_MODULE := app.main:app
PORT := 8010
COVERAGE_MIN := 80

.DEFAULT_GOAL := help

.PHONY: help install install-dev setup dev dev-backend dev-frontend dev-compose dev-compose-bg dev-logs dev-stop build build-server build-slskd build-wizard buildx-all push lint lint-fix format format-check typecheck test test-unit test-integration test-fast coverage security audit pre-commit-install pre-commit-run docker-build docker-run docker-compose-up docker-compose-down docker-logs wizard ci clean clean-all

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# === Setup ===

install: ## Install production dependencies
	$(UV) sync --frozen

install-dev: ## Install development dependencies
	$(UV) sync --frozen --all-extras

setup: install-dev pre-commit-install build-wizard ## Full dev environment setup

# === Development ===

dev: ## Start backend with hot reload
	$(UV) run fastapi dev app/main.py --port $(PORT)

dev-backend: ## Start backend only with uvicorn
	$(UV) run uvicorn $(APP_MODULE) --reload --host 0.0.0.0 --port $(PORT)

dev-frontend: ## Start frontend with hot reload
	cd frontend && npm run dev -- --host 0.0.0.0 --port 3000

dev-compose: ## Start full stack with Docker Compose (hot reload)
	docker compose -f docker-compose.dev.yml up --build

dev-compose-bg: ## Start full stack in background
	docker compose -f docker-compose.dev.yml up -d --build

dev-logs: ## View development logs
	docker compose -f docker-compose.dev.yml logs -f

dev-stop: ## Stop development environment
	docker compose -f docker-compose.dev.yml down

# === Build ===

build: build-server build-slskd build-wizard ## Build all Docker images

build-server: ## Build noiseport-server image
	docker build -t maxenceroux/noiseport-server:latest -f Dockerfile .

build-slskd: ## Build noiseport-server-slskd image
	docker build -t maxenceroux/noiseport-server-slskd:latest -f Dockerfile.slskd .

build-wizard: ## Build noiseport-server-wizard image
	docker build -t maxenceroux/noiseport-server-wizard:latest -f Dockerfile.wizard .

buildx-all: ## Build and push all multi-arch images (amd64 + arm64)
	docker buildx build --platform linux/amd64,linux/arm64 -t maxenceroux/noiseport-server:latest -f Dockerfile . --push
	docker buildx build --platform linux/amd64,linux/arm64 -t maxenceroux/noiseport-server-slskd:latest -f Dockerfile.slskd . --push

push: ## Push all Docker images
	docker push maxenceroux/noiseport-server:latest
	docker push maxenceroux/noiseport-server-slskd:latest
	docker push maxenceroux/noiseport-server-wizard:latest

# === Quality ===

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

# === Testing ===

test: ## Run all tests
	$(UV) run pytest

test-unit: ## Run unit tests only
	$(UV) run pytest -m "unit"

test-integration: ## Run integration tests only
	$(UV) run pytest -m "integration"

test-fast: ## Run tests excluding slow ones
	$(UV) run pytest -m "not slow"

coverage: ## Run tests with coverage report
	$(UV) run pytest --cov=app --cov=config --cov-report=html --cov-report=term-missing --cov-fail-under=$(COVERAGE_MIN)

# === Security ===

security: ## Run security checks with bandit
	$(UV) run bandit -r app config

audit: ## Audit dependencies for vulnerabilities
	$(UV) run safety check

# === Docker ===

docker-build: ## Build Docker image
	docker build -t downloader:latest .

docker-run: ## Run Docker container
	docker run -p $(PORT):80 --env-file .env downloader:latest

docker-compose-up: ## Start services with docker-compose
	docker compose up -d

docker-compose-down: ## Stop services
	docker compose down

docker-logs: ## View docker-compose logs
	docker compose logs -f

wizard: ## Run the setup wizard
	@test -f wizard-config/.env || touch wizard-config/.env
	docker compose -f docker-compose.wizard.yml up

# === Pre-commit ===

pre-commit-install: ## Install pre-commit hooks
	$(UV) run pre-commit install

pre-commit-run: ## Run pre-commit on all files
	$(UV) run pre-commit run --all-files

# === CI ===

ci: ## Run all CI checks (lint + test + security)
	$(UV) run ruff check .
	$(UV) run ruff format . --check
	$(UV) run mypy app config
	$(UV) run pytest --cov=app --cov=config --cov-report=xml --cov-fail-under=$(COVERAGE_MIN)
	$(UV) run bandit -r app config -f json -o bandit-report.json

# === Cleanup ===

clean: ## Remove generated files
	rm -rf .coverage htmlcov/ .pytest_cache/ .mypy_cache/ .ruff_cache/
	find . -type d -name "__pycache__" -delete
	find . -type f -name "*.pyc" -delete

clean-all: clean ## Remove everything including venv
	rm -rf .venv/
