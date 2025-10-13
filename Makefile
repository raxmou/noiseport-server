# Production-ready FastAPI Makefile

.PHONY: help install install-dev lint format test test-unit test-integration coverage build run clean docker-build docker-run docker-compose-up docker-compose-down docker-compose-dev docker-compose-dev-down docker-build-api docker-build-slskd docker-build-all docker-push-api docker-push-slskd docker-push-all docker-login docker-release pre-commit-install pre-commit-run security audit docs serve-docs

# Default target
.DEFAULT_GOAL := help

# Variables
PYTHON := python
UV := uv
APP_MODULE := app.main:app
PORT := 8000
COVERAGE_MIN := 80

# Docker variables
DOCKER_ORG := maxenceroux
DOCKER_REPO_API := music-aggregator-api
DOCKER_REPO_SLSKD := music-aggregator-slskd
GIT_SHA := $(shell git rev-parse --short HEAD)
GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD | sed 's/\//-/g')
VERSION := $(shell git describe --tags --always --dirty)

# Docker image names
API_IMAGE := $(DOCKER_ORG)/$(DOCKER_REPO_API)
SLSKD_IMAGE := $(DOCKER_ORG)/$(DOCKER_REPO_SLSKD)

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Installation targets
install: ## Install production dependencies
	$(UV) sync --frozen

install-dev: ## Install development dependencies
	$(UV) sync --frozen --all-extras

# Code quality targets
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

# Testing targets
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

# Security targets
security: ## Run security checks
	$(UV) run bandit -r app config

audit: ## Audit dependencies for vulnerabilities
	$(UV) run safety check

security-all: security audit ## Run all security checks

# Application targets
run: ## Run the application in development mode
	$(UV) run uvicorn $(APP_MODULE) --reload --host 0.0.0.0 --port $(PORT)

run-prod: ## Run the application in production mode
	$(UV) run uvicorn $(APP_MODULE) --host 0.0.0.0 --port $(PORT) --workers 4

dev: ## Run development server with auto-reload
	$(UV) run fastapi dev app/main.py --port $(PORT)

# Docker targets
docker-build: ## Build Docker image
	docker build -t downloader:latest .

docker-run: ## Run Docker container
	docker run -p $(PORT):80 --env-file .env downloader:latest

# Docker build targets for individual services
docker-build-api: ## Build API Docker image
	docker build -t $(API_IMAGE):latest -t $(API_IMAGE):$(GIT_SHA) -t $(API_IMAGE):$(GIT_BRANCH) .

docker-build-slskd: ## Build SLSKD Docker image
	docker build -f Dockerfile.slskd -t $(SLSKD_IMAGE):latest -t $(SLSKD_IMAGE):$(GIT_SHA) -t $(SLSKD_IMAGE):$(GIT_BRANCH) .

docker-build-all: docker-build-api docker-build-slskd ## Build all Docker images

# Docker push targets
docker-push-api: ## Push API Docker image to registry
	docker push $(API_IMAGE):latest
	docker push $(API_IMAGE):$(GIT_SHA)
	docker push $(API_IMAGE):$(GIT_BRANCH)

docker-push-slskd: ## Push SLSKD Docker image to registry
	docker push $(SLSKD_IMAGE):latest
	docker push $(SLSKD_IMAGE):$(GIT_SHA)
	docker push $(SLSKD_IMAGE):$(GIT_BRANCH)

docker-push-all: docker-push-api docker-push-slskd ## Push all Docker images to registry

# Docker login
docker-login: ## Login to Docker Hub
	@echo "Logging in to Docker Hub..."
	@docker login

# Docker complete workflow targets
docker-release: docker-build-all docker-push-all ## Build and push all Docker images

docker-compose-up: ## Start services with docker-compose
	docker compose up -d

docker-compose-dev: ## Start services with docker-compose for development (local builds)
	docker compose -f docker-compose.dev.yml up -d

docker-compose-down: ## Stop services with docker-compose
	docker compose down

docker-compose-dev-down: ## Stop development services with docker-compose
	docker compose -f docker-compose.dev.yml down

docker-logs: ## View docker-compose logs
	docker compose logs -f

# Pre-commit targets
pre-commit-install: ## Install pre-commit hooks
	$(UV) run pre-commit install

pre-commit-run: ## Run pre-commit on all files
	$(UV) run pre-commit run --all-files

pre-commit-update: ## Update pre-commit hooks
	$(UV) run pre-commit autoupdate

# Cleaning targets
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

# CI/CD targets
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

# Environment setup
setup: install-dev pre-commit-install ## Set up development environment
	@echo "Development environment setup complete!"
	@echo "Run 'make run' to start the development server"

# Build targets
build: ## Build the application
	$(UV) build

build-docker: docker-build ## Build Docker image

# Quick checks
check: lint typecheck test ## Run quick checks (lint, typecheck, test)

check-all: lint typecheck test security ## Run all checks

# Import targets (keep existing functionality)
import-incomplete: ## Import incomplete music files
	beet -c beet_config.yaml import /media/pi/Lexar/music/downloads

rerun-import-full-refresh: ## Rerun import with full refresh
	beet -c beet_config_full_refresh.yaml import /media/pi/Lexar/music/complete