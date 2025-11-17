# Multi-stage production Dockerfile for FastAPI application with React frontend

# -----------------------
# Frontend build stage
# -----------------------
FROM node:20.19-bullseye-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false
RUN npm ci --include=dev

COPY frontend/ ./
RUN npm run build

# -----------------------
# Backend deps stage
# -----------------------
FROM python:3.11-slim as backend-builder

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
  && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_CACHE_DIR=/tmp/uv-cache

WORKDIR /app
COPY pyproject.toml uv.lock README.md ./
RUN rm -rf .venv
RUN uv venv /app/.venv && \
    uv sync --frozen --no-cache --no-dev --project . --python=/app/.venv/bin/python

# Optional sanity check
RUN uv run python -m site && uv run uv pip list

# -----------------------
# Production stage
# -----------------------
FROM python:3.11-slim as production

ARG UID=1000
ARG GID=1000

# Install any OS packages you truly need at runtime (do this as root)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
  && rm -rf /var/lib/apt/lists/*

# If you actually need Docker CLI *inside this container*, add the repo while still root:
# (Most FastAPI apps don't need this; feel free to remove.)
RUN install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    chmod a+r /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && apt-get install -y docker-ce-cli docker-compose-plugin && \
    rm -rf /var/lib/apt/lists/*

# Create user/group matching host ids
RUN groupadd -g ${GID} appgroup && useradd -u ${UID} -g appgroup -M -r appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app"

WORKDIR /app
RUN chown -R appuser:appgroup /app

# Copy venv + app code as appuser
COPY --from=backend-builder --chown=appuser:appgroup /app/.venv /app/.venv
COPY --chown=appuser:appgroup . .
COPY --from=frontend-builder --chown=appuser:appgroup /app/frontend/dist /app/frontend/dist

# Create mount points (bind mounts will override at runtime)
RUN mkdir -p /music/downloads /music/complete /music/incomplete && \
    chown -R appuser:appgroup /music

USER appuser

# Health check — container listens on 80 (not 8000)
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/api/v1/system/health || exit 1

EXPOSE 80
CMD ["uvicorn", "app.core.app:app", "--host", "0.0.0.0", "--port", "80"]
