# Multi-stage production Dockerfile for FastAPI application

# Build stage
FROM python:3.11-slim as builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast Python package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_CACHE_DIR=/tmp/uv-cache

# Copy dependency files
WORKDIR /app
COPY pyproject.toml uv.lock README.md ./
RUN rm -rf .venv
# Install dependencies to a virtual environment
RUN uv venv /app/.venv && \
    uv sync --frozen --no-cache --no-dev --project . --python=/app/.venv/bin/python

# 👀 Optional: sanity check
RUN uv run python -m site && \
    uv run uv pip list


# Production stage
FROM python:3.11-slim as production

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app"

# Create app directory and set ownership
WORKDIR /app
RUN chown -R appuser:appuser /app

# Copy virtual environment from builder stage
COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv

# Copy application code
COPY --chown=appuser:appuser . .

# Create directories for file storage
RUN mkdir -p /music/downloads /music/complete && \
    chown -R appuser:appuser /music

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/system/health || exit 1

EXPOSE 8000
# Run the application
CMD ["uvicorn", "app.core.app:app", "--host", "0.0.0.0", "--port", "80"]