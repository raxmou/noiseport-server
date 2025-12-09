# NoisePort Server

[![CI/CD Pipeline](https://github.com/maxenceroux/downloader/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/maxenceroux/downloader/actions/workflows/ci-cd.yml)
[![codecov](https://codecov.io/gh/maxenceroux/downloader/branch/main/graph/badge.svg)](https://codecov.io/gh/maxenceroux/downloader)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.117+-green.svg)](https://fastapi.tiangolo.com)

Noiseport Server is the self-hosted backend that powers the Noiseport ecosystem.
It manages music downloads, metadata, and playback integration — bridging your local library with services like Soulseek, Spotify, Navidrome, and Jellyfin.

🎧 Overview

Noiseport Server is a production-ready FastAPI application designed for personal music hosting and management.
It automates acquisition, organization, and serving of your music collection, while remaining fully open-source and self-hosted.

It forms the backend foundation for:

Component	Description
Noiseport (app)	The desktop and mobile clients to explore and stream your library.
Noiseport Server	The backend service (this project). Handles downloads, metadata, configuration, and API access.
Noiseport Commons	The public manifesto and documentation site.

## Features

### 🧙 **Setup Wizard**
- **Web-based configuration** with React + Mantine UI
- **Multi-step wizard** for easy initial setup
- **Real-time validation** and connection testing
- **Service integration** for Navidrome, Jellyfin, Spotify, and Soulseek
- **Responsive design** that works on desktop and mobile

### 🚀 **Production Ready**
- **FastAPI** framework with async support
- **Pydantic** models for type safety and validation
- **uvicorn** ASGI server with multi-worker support
- **Comprehensive logging** with configurable levels
- **Health checks** and monitoring endpoints

### 🔒 **Security**
- **VPN-only access** via self-hosted Headscale (optional)
- **MagicDNS** for secure service discovery
- **Input validation** with Pydantic schemas
- **Security scanning** with Bandit and Safety
- **Environment-based configuration** 
- **CORS protection** with configurable origins
- **Non-root Docker containers**
- **Per-device VPN authentication** and authorization

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

5. **Configure using the Setup Wizard:**
   ```bash
   # Access the setup wizard in your browser
   open http://localhost:8000/wizard
   ```

The setup wizard provides a user-friendly interface to configure all services and settings.

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

### Setup Wizard

After starting the application, configure your music client stack using the web-based setup wizard:

```bash
# Build the frontend (if not already built)
make build-wizard

# Access the wizard at http://localhost:8000/wizard
make wizard
```

The setup wizard guides you through:
1. **Headscale VPN** - (Optional) Set up secure VPN-only access with MagicDNS
2. **Local Libraries** - Connect to Navidrome and Jellyfin servers
3. **Spotify API** - Configure Spotify integration for music discovery  
4. **Soulseek/slskd** - Set up music downloading service
5. **Music Paths** - Configure download and storage directories
6. **Optional Features** - Enable scrobbling, downloads, and discovery features
7. **Summary** - Review and save your configuration

### 🔒 VPN-Only Access (Recommended for Multi-User)

For secure remote access, the wizard includes Headscale VPN configuration:
- **Self-hosted VPN** using WireGuard protocol
- **MagicDNS** for easy service discovery (`http://navidrome:4533`)
- **Per-device authentication** for granular access control
- **Works everywhere** - home, mobile, coffee shops, etc.

See [VPN_ACCESS_GUIDE.md](VPN_ACCESS_GUIDE.md) for detailed setup instructions.

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

## Setup Wizard

The easiest way to configure the application is through the **Web-based Setup Wizard**. This provides a user-friendly interface for configuring all services without manually editing configuration files.

### Quick Setup

1. **Start the wizard:**
   ```bash
   # Using docker compose (recommended)
   docker compose -f docker-compose.wizard.yml up -d
   
   # Or using make
   make wizard
   ```

2. **Access the setup wizard:**
   ```bash
   # Open in browser
   open http://localhost:8000/wizard
   ```

3. **Follow the wizard steps:**
   - **Local Libraries**: Connect to Navidrome and Jellyfin (optional)
   - **Spotify API**: Configure Spotify integration for enhanced discovery
   - **Soulseek/slskd**: Set up the core music downloading service
   - **Music Paths**: Configure download and storage directories
   - **Optional Features**: Enable additional features like scrobbling
   - **Summary**: Review and save your configuration

The wizard automatically generates and saves configuration files to the `wizard-config/` directory.

### Configuration Persistence

All wizard-generated configuration files are stored in `wizard-config/`:
- `.env` - Environment variables and credentials
- `docker-compose.full.yml` - Full stack compose file
- `slskd.yml` - Soulseek daemon configuration
- `start-music-stack.sh` - Startup script
- `launch_services.log` - Service launch logs

This directory is mounted into the wizard container to persist your configuration to the host system.

### Starting the Full Stack

After configuration, start all services:

**Option 1: Using the wizard interface**
- Click "Launch Services" button in the wizard

**Option 2: Using the generated script**
```bash
./wizard-config/start-music-stack.sh
```

**Option 3: Using docker compose**
```bash
docker compose -f wizard-config/docker-compose.full.yml up -d
```

### Wizard Features

- 🎨 **Modern UI**: Built with React and Mantine components
- ✅ **Real-time Validation**: Instant feedback on configuration errors
- 🔗 **Connection Testing**: Test service connections before saving
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔒 **Secure**: No sensitive data stored in browser, all saved to `wizard-config/`
- 🚀 **Frontend from Image**: Frontend is served from the Docker image, no local build needed

### Technical Details

The wizard uses a selective volume mounting strategy:
- **Mounts**: Only `wizard-config/` is mounted for config persistence
- **Frontend**: Served from the built frontend in the Docker image
- **Benefits**: No source code conflicts, fast startup, portable configuration

See [`wizard-config/README.md`](wizard-config/README.md) for more details on the configuration directory.

### Manual Configuration (Alternative)

If you prefer to configure manually, the application uses environment variables for configuration. Copy `.env.example` to `.env` and customize:

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

#### Configuration Endpoints
- `GET /api/v1/config` - Get current configuration
- `POST /api/v1/config` - Save configuration to .env file
- `POST /api/v1/config/validate` - Validate configuration inputs
- `POST /api/v1/config/test-connection` - Test service connections

#### Setup Wizard
- `GET /wizard` - Access the web-based setup wizard

### Interactive Documentation

When running in development mode, access the interactive API documentation:
- **Setup Wizard**: `http://localhost:8000/wizard`
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
│   ├── api/               # API routes (including config endpoints)
│   ├── core/              # Core functionality  
│   ├── models/            # Pydantic models (including config models)
│   ├── services/          # Business logic
│   └── utils/             # Utilities
├── config/                # Configuration
├── frontend/              # React setup wizard
│   ├── src/               # React source code
│   ├── dist/              # Built frontend assets
│   └── package.json       # Frontend dependencies
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