# NoisePort Server

Self-hosted backend for the NoisePort music ecosystem.

## Overview

FastAPI application that manages music downloads, metadata, and playback integration. Bridges your local library with Soulseek, Spotify, Navidrome, and Jellyfin. Includes a web-based setup wizard and multi-arch Docker images for deployment on Raspberry Pi or cloud.

## Tech Stack

- Python 3.11+, FastAPI, Pydantic
- uv (package manager)
- React + Mantine (setup wizard frontend)
- Docker (multi-stage, multi-arch)
- ruff (lint/format), mypy (types), pytest (tests), bandit (security)

## Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/)
- Docker and Docker Compose (for containerized deployment)

## Getting Started

```bash
make setup      # Install deps + pre-commit hooks + build wizard
cp .env.example .env
make dev        # Backend at localhost:8010, wizard at localhost:8010/wizard
```

## Usage

```bash
make dev              # Backend with hot reload
make dev-compose      # Full stack via Docker Compose (hot reload)
make build            # Build all Docker images
make push             # Push all Docker images
make lint             # Lint with ruff
make format           # Format with ruff
make typecheck        # Type check with mypy
make test             # Run all tests
make coverage         # Tests with coverage report
make security         # Security scan with bandit
make ci               # Run all CI checks
make wizard           # Run setup wizard
```

## Deployment

Multi-arch Docker images (amd64 + arm64) pushed to Docker Hub:
- `maxenceroux/noiseport-server`
- `maxenceroux/noiseport-server-slskd`
- `maxenceroux/noiseport-server-wizard`

Build and push: `make buildx-all` or `make build && make push`.

## Architecture

```
app/
├── api/            # API routes (downloads, config, system)
├── core/           # Core functionality
├── models/         # Pydantic models
├── services/       # Business logic
└── utils/          # Utilities
config/             # Pydantic settings
frontend/           # React setup wizard (Mantine)
tests/              # pytest suite (unit + integration)
```

API endpoints:
- `GET /api/v1/system/health` — health check
- `POST /api/v1/downloads/download` — start album download
- `GET /api/v1/downloads/search/{artist}/{album}` — search
- `GET/POST /api/v1/config` — configuration management
- `GET /wizard` — setup wizard UI

## License

MIT.
