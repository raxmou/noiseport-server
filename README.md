# Downloader API

[![CI/CD Pipeline](https://github.com/maxenceroux/downloader/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/maxenceroux/downloader/actions/workflows/ci-cd.yml)
[![codecov](https://codecov.io/gh/maxenceroux/downloader/branch/main/graph/badge.svg)](https://codecov.io/gh/maxenceroux/downloader)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.117+-green.svg)](https://fastapi.tiangolo.com)

A production-ready FastAPI application for music downloading and management, featuring comprehensive testing, security, monitoring, and deployment capabilities.

## Features

### 🚀 **Production Ready**
- **FastAPI** framework with async support
- **Pydantic** models for type safety and validation
- **uvicorn** ASGI server with multi-worker support
- **Comprehensive logging** with configurable levels
- **Health checks** and monitoring endpoints

### 🔒 **Security**
- **Input validation** with Pydantic schemas
- **Security scanning** with Bandit and Safety
- **Environment-based configuration** 
- **CORS protection** with configurable origins
- **Non-root Docker containers**

### 🧪 **Testing & Quality**
- **pytest** test suite with coverage reporting
- **Unit and integration tests**
- **Code linting** with ruff
- **Type checking** with mypy
- **Pre-commit hooks** for code quality

### 🐳 **Docker & Deployment**
- **Multi-stage Dockerfile** for optimized images
- **Docker Compose** for local development
- **Container hardening** with non-root users
- **Health checks** and proper logging

### 📊 **Monitoring**
- **Prometheus metrics** endpoint
- **Structured logging** with JSON output
- **Health check endpoints**
- **Performance monitoring**

### 🔄 **CI/CD**
- **GitHub Actions** workflows
- **Automated testing** and security scanning
- **Docker image building** and publishing
- **Coverage reporting**

## Quick Start

### Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) package manager
- Docker and Docker Compose (optional)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/maxenceroux/downloader.git
   cd downloader
   ```

2. **Set up the development environment:**
   ```bash
   make setup
   ```

3. **Copy environment configuration:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run the application:**
   ```bash
   make dev
   ```

The API will be available at `http://localhost:8000` with interactive documentation at `http://localhost:8000/docs`.

## Development

### Environment Setup

```bash
# Install development dependencies
make install-dev

# Set up pre-commit hooks
make pre-commit-install

# Run all setup tasks
make setup
```

### Running the Application

```bash
# Development mode with auto-reload
make dev

# Production mode
make run-prod

# Using Docker
make docker-build
make docker-run
```

### Code Quality

```bash
# Lint code
make lint

# Format code
make format

# Type checking
make typecheck

# Run all checks
make check-all
```

### Testing

```bash
# Run all tests
make test

# Run with coverage
make coverage

# Run only unit tests
make test-unit

# Run only integration tests
make test-integration
```

### Security

```bash
# Security scanning
make security

# Dependency audit
make audit

# All security checks
make security-all
```

## Configuration

The application uses environment variables for configuration. Copy `.env.example` to `.env` and customize:

### Key Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_NAME` | Application name | "Downloader API" |
| `ENVIRONMENT` | Environment (development/production) | "development" |
| `DEBUG` | Enable debug mode | `false` |
| `HOST` | Server host | "0.0.0.0" |
| `PORT` | Server port | 8000 |
| `SLSKD_HOST` | SLSKD server URL | "http://slskd:5030" |
| `SLSKD_USERNAME` | SLSKD username | "slskd" |
| `SLSKD_PASSWORD` | SLSKD password | "slskd" |
| `LOG_LEVEL` | Logging level | "INFO" |

### Configuration Files

- `config/settings.py` - Main configuration with Pydantic settings
- `.env` - Environment variables (create from `.env.example`)
- `pyproject.toml` - Project configuration and dependencies

## API Documentation

### Endpoints

#### System Endpoints
- `GET /` - Root endpoint with API information
- `GET /api/v1/system/health` - Health check
- `GET /api/v1/system/info` - API information
- `GET /api/v1/system/metrics` - Prometheus metrics

#### Download Endpoints
- `POST /api/v1/downloads/download` - Start album download
- `GET /api/v1/downloads/search/{artist}/{album}` - Search without downloading

### Interactive Documentation

When running in development mode, access the interactive API documentation:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI Schema**: `http://localhost:8000/openapi.json`

## Docker Deployment

### Using Docker Compose

```bash
# Start all services
make docker-compose-up

# View logs
make docker-logs

# Stop services
make docker-compose-down
```

### Building Custom Images

```bash
# Build Docker image
make docker-build

# Run container
make docker-run
```

## Testing

The test suite includes:

### Unit Tests
- Model validation
- Configuration testing
- Service logic testing
- API endpoint validation

### Integration Tests
- Full application workflow
- Service integration
- External API interaction

### Running Tests

```bash
# All tests
make test

# With coverage report
make coverage

# Specific test types
make test-unit      # Unit tests only
make test-integration # Integration tests only
make test-fast      # Exclude slow tests
```

## Architecture

### Project Structure

```
downloader/
├── app/                    # Application code
│   ├── api/               # API routes
│   ├── core/              # Core functionality
│   ├── models/            # Pydantic models
│   ├── services/          # Business logic
│   └── utils/             # Utilities
├── config/                # Configuration
├── tests/                 # Test suite
├── docker/                # Docker configurations
├── scripts/               # Utility scripts
└── .github/               # CI/CD workflows
```

### Technology Stack

- **Framework**: FastAPI
- **Package Manager**: uv
- **Testing**: pytest + coverage
- **Linting**: ruff + mypy
- **Security**: bandit + safety
- **Containerization**: Docker
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus metrics

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- **GitHub Issues**: [Create an issue](https://github.com/maxenceroux/downloader/issues)
- **Documentation**: Available in `/docs` when running the application
- **API Documentation**: Interactive docs at `/docs` endpoint

---

Built with ❤️ using FastAPI and modern Python development practices.