# CLAUDE.md

## Project Overview

Self-hosted music backend. Python 3.11+ FastAPI application with React setup wizard. Manages music downloads via Soulseek/slskd, integrates with Spotify, Navidrome, and Jellyfin. Packaged as multi-arch Docker images.

## Commands

```bash
make setup          # Full dev setup (deps + hooks + wizard build)
make install-dev    # Install dev dependencies (uv)
make dev            # Backend with hot reload (port 8010)
make dev-compose    # Full stack via Docker Compose
make build          # Build all Docker images
make push           # Push all images
make buildx-all     # Multi-arch build + push
make lint           # Lint with ruff
make format         # Format with ruff
make typecheck      # Type check with mypy
make test           # Run all tests
make test-unit      # Unit tests only
make test-fast      # Skip slow tests
make coverage       # Tests with coverage (min 80%)
make security       # Bandit security scan
make audit          # Dependency vulnerability audit
make ci             # All CI checks
make wizard         # Run setup wizard
make clean          # Remove caches
make clean-all      # Remove caches + venv
```

## Architecture

```
app/
├── api/            # FastAPI routes
│   └── v1/            # /api/v1/downloads, /api/v1/config, /api/v1/system
├── core/           # Core business logic
├── models/         # Pydantic request/response models
├── services/       # Service layer (slskd, spotify, etc.)
└── utils/          # Utilities
config/
└── settings.py     # Pydantic settings (env-based)
frontend/           # React + Mantine setup wizard
tests/              # pytest (unit + integration)
```

## Conventions

- uv for dependency management (`pyproject.toml`)
- ruff for linting and formatting
- mypy for type checking
- Pydantic models for all validation
- Environment-based configuration (`.env` -> `config/settings.py`)
- Pre-commit hooks enforced

## Key Dependencies

- `fastapi`, `uvicorn` — web framework
- `pydantic` — data validation
- `ruff` — linter/formatter
- `mypy` — type checker
- `pytest` — testing
- `bandit` — security scanning
