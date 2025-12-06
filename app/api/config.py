"""Configuration API endpoints for the setup wizard."""

import hashlib
import json
import os
import subprocess
import threading
from pathlib import Path

import requests
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from app.core.logging import get_logger
from app.models.config import (
    ConfigValidationResponse,
    ConnectionTestRequest,
    ConnectionTestResponse,
    ValidationError,
    WizardConfiguration,
)
from app.services.compose_runner import ComposeRunner
from config import settings

# Constants
DOCKER_COMPOSE_FULL_FILE = "docker-compose.full.yml"
DOCKER_COMPOSE_DEV_FILE = "docker-compose.dev.yml"
ALLOWED_CONTAINER_NAMES = ["navidrome", "jellyfin", "slskd", "fastapi"]

# Project root directory (parent of app directory)
PROJECT_ROOT = Path(__file__).parent.parent.parent


def get_compose_file_args():
    """Get the appropriate docker-compose file arguments based on what exists."""
    if os.path.exists(DOCKER_COMPOSE_DEV_FILE):
        return ["-f", DOCKER_COMPOSE_DEV_FILE]
    elif os.path.exists(DOCKER_COMPOSE_FULL_FILE):
        return ["-f", DOCKER_COMPOSE_FULL_FILE]
    else:
        return []  # Use default docker-compose.yml


logger = get_logger(__name__)

router = APIRouter(tags=["Configuration"])


@router.get("/config", response_model=WizardConfiguration)
async def get_current_config() -> WizardConfiguration:
    """Get the current configuration."""
    try:
        # Build configuration from current settings
        config = WizardConfiguration(
            tailscale={
                "enabled": getattr(settings, "tailscale_enabled", False),
                "ip": getattr(settings, "tailscale_ip", ""),
            },
            headscale={
                "enabled": getattr(settings, "headscale_enabled", False),
                "setupMode": getattr(settings, "headscale_setup_mode", "domain"),
                "domain": getattr(settings, "headscale_domain", ""),
                "serverIp": getattr(settings, "headscale_server_ip", ""),
                "serverUrl": getattr(settings, "headscale_server_url", ""),
                "apiKey": getattr(settings, "headscale_api_key", ""),
                "baseDomain": getattr(settings, "headscale_base_domain", "headscale.local"),
            },
            navidrome={
                "enabled": settings.navidrome_enabled,
                "url": settings.navidrome_url,
                "username": settings.navidrome_username,
                "password": settings.navidrome_password,
            },
            jellyfin={
                "enabled": settings.jellyfin_enabled,
                "url": settings.jellyfin_url,
                "username": settings.jellyfin_username,
                "password": settings.jellyfin_password,
            },
            spotify={
                "enabled": settings.spotify_enabled,
                "clientId": settings.spotify_client_id,
                "clientSecret": settings.spotify_client_secret,
            },
            soulseek={
                "enabled": True,  # Always enabled since it's core functionality
                "host": settings.slskd_host,
                "username": settings.slskd_username,
                "password": settings.slskd_password,
                "soulseekUsername": getattr(settings, "soulseek_username", ""),
                "soulseekPassword": getattr(settings, "soulseek_password", ""),
            },
            musicPaths={
                "hostMusicPath": settings.host_music_path,
            },
            features={
                "scrobbling": settings.scrobbling_enabled,
                "downloads": settings.downloads_enabled,
                "discovery": settings.discovery_enabled,
                "lastfmApiKey": settings.lastfm_api_key,
                "lastfmSecret": settings.lastfm_secret,
            },
        )

        logger.info("Retrieved current configuration")
        return config

    except Exception as e:
        logger.error(f"Failed to get configuration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve configuration",
        )


@router.post("/config")
async def save_configuration(config: WizardConfiguration) -> JSONResponse:
    """Save the configuration to environment file."""
    import os

    print(config)
    try:
        # Get wizard config directory from settings (environment variable or default)
        wizard_config_dir = settings.wizard_config_dir

        # Ensure wizard config directory exists
        os.makedirs(wizard_config_dir, exist_ok=True)

        # Convert config to environment variables
        env_vars = {
            # Tailscale
            "TAILSCALE_ENABLED": str(config.tailscale.enabled).lower(),
            "TAILSCALE_IP": config.tailscale.ip,
            # Headscale
            "HEADSCALE_ENABLED": str(config.headscale.enabled).lower(),
            "HEADSCALE_SETUP_MODE": config.headscale.setupMode,
            "HEADSCALE_DOMAIN": config.headscale.domain,
            "HEADSCALE_SERVER_IP": config.headscale.serverIp,
            "HEADSCALE_SERVER_URL": config.headscale.serverUrl,
            "HEADSCALE_API_KEY": config.headscale.apiKey,
            "HEADSCALE_BASE_DOMAIN": config.headscale.baseDomain,
            # Navidrome
            "NAVIDROME_ENABLED": str(config.navidrome.enabled).lower(),
            "NAVIDROME_URL": config.navidrome.url,
            "NAVIDROME_USERNAME": config.navidrome.username,
            "NAVIDROME_PASSWORD": config.navidrome.password,
            # Jellyfin
            "JELLYFIN_ENABLED": str(config.jellyfin.enabled).lower(),
            "JELLYFIN_URL": config.jellyfin.url,
            "JELLYFIN_USERNAME": config.jellyfin.username,
            "JELLYFIN_PASSWORD": config.jellyfin.password,
            # Spotify
            "SPOTIFY_ENABLED": str(config.spotify.enabled).lower(),
            "SPOTIFY_CLIENT_ID": config.spotify.clientId,
            "SPOTIFY_CLIENT_SECRET": config.spotify.clientSecret,
            # Soulseek/slskd
            "SLSKD_HOST": config.soulseek.host,
            "SLSKD_USERNAME": config.soulseek.username,
            "SLSKD_PASSWORD": config.soulseek.password,
            "SOULSEEK_USERNAME": config.soulseek.soulseekUsername,
            "SOULSEEK_PASSWORD": config.soulseek.soulseekPassword,
            # Paths
            "HOST_MUSIC_PATH": config.musicPaths.hostMusicPath,
            # Features
            "SCROBBLING_ENABLED": str(config.features.scrobbling).lower(),
            "DOWNLOADS_ENABLED": str(config.features.downloads).lower(),
            "DISCOVERY_ENABLED": str(config.features.discovery).lower(),
            "LASTFM_API_KEY": config.features.lastfmApiKey,
            "LASTFM_SECRET": config.features.lastfmSecret,
        }

        # Path to .env file in wizard-config directory
        env_file_path = os.path.join(wizard_config_dir, ".env")
        existing_vars = {}

        # Create .env file if it does not exist
        if not os.path.exists(env_file_path):
            env_example_path = str(PROJECT_ROOT / ".env.example")
            if os.path.exists(env_example_path):
                with (
                    open(env_example_path) as example_file,
                    open(env_file_path, "w") as env_file,
                ):
                    env_file.write(example_file.read())
                logger.info(
                    f"Created new .env file from .env.example at {env_file_path}"
                )
            else:
                with open(env_file_path, "w") as f:
                    f.write("# Music Client Configuration\n")
                    f.write("# Generated by Setup Wizard\n\n")
                logger.warning(
                    f".env.example not found at {env_example_path}. Created a blank .env file at {env_file_path}"
                )
        # Before writing .env

        with open(env_file_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    existing_vars[key] = value

        # Update with new values
        existing_vars.update(env_vars)

        # Write back to .env file
        with open(env_file_path, "w") as f:
            f.write("# Music Client Configuration\n")
            f.write("# Generated by Setup Wizard\n\n")

            # Group related settings
            f.write("# Application\n")
            for key in ["APP_NAME", "ENVIRONMENT", "DEBUG", "LOG_LEVEL"]:
                if key in existing_vars:
                    f.write(f"{key}={existing_vars[key]}\n")

            f.write("\n# Server\n")
            for key in ["HOST", "PORT", "WORKERS"]:
                if key in existing_vars:
                    f.write(f"{key}={existing_vars[key]}\n")

            f.write("\n# Tailscale\n")
            for key in ["TAILSCALE_ENABLED", "TAILSCALE_IP"]:
                f.write(f"{key}={existing_vars.get(key, '')}\n")

            f.write("\n# Headscale\n")
            for key in [
                "HEADSCALE_ENABLED",
                "HEADSCALE_SETUP_MODE",
                "HEADSCALE_DOMAIN",
                "HEADSCALE_SERVER_IP",
                "HEADSCALE_SERVER_URL",
                "HEADSCALE_API_KEY",
                "HEADSCALE_BASE_DOMAIN",
            ]:
                f.write(f"{key}={existing_vars.get(key, '')}\n")

            f.write("\n# Navidrome\n")
            for key in [
                "NAVIDROME_ENABLED",
                "NAVIDROME_URL",
                "NAVIDROME_USERNAME",
                "NAVIDROME_PASSWORD",
            ]:
                f.write(f"{key}={existing_vars.get(key, '')}\n")

            f.write("\n# Jellyfin\n")
            for key in [
                "JELLYFIN_ENABLED",
                "JELLYFIN_URL",
                "JELLYFIN_USERNAME",
                "JELLYFIN_PASSWORD",
            ]:
                f.write(f"{key}={existing_vars.get(key, '')}\n")

            f.write("\n# Spotify\n")
            for key in [
                "SPOTIFY_ENABLED",
                "SPOTIFY_CLIENT_ID",
                "SPOTIFY_CLIENT_SECRET",
            ]:
                f.write(f"{key}={existing_vars.get(key, '')}\n")

            f.write("\n# Soulseek/slskd\n")
            for key in [
                "SLSKD_HOST",
                "SLSKD_USERNAME",
                "SLSKD_PASSWORD",
                "SOULSEEK_USERNAME",
                "SOULSEEK_PASSWORD",
            ]:
                f.write(f"{key}={existing_vars.get(key, '')}\n")

            # Host Paths
            for key in ["HOST_MUSIC_PATH"]:
                f.write(f"{key}={existing_vars.get(key, '')}\n")

            f.write("\n# Container Paths\n")
            f.write("# Automatically derived from HOST_MUSIC_PATH\n")
            f.write("DOWNLOAD_PATH=/music/downloads\n")
            f.write("COMPLETE_PATH=/music/complete\n")

            f.write("\n# Features\n")
            for key in ["SCROBBLING_ENABLED", "DOWNLOADS_ENABLED", "DISCOVERY_ENABLED"]:
                f.write(f"{key}={existing_vars.get(key, '')}\n")

            f.write("\n# Last.fm\n")
            for key in ["LASTFM_API_KEY", "LASTFM_SECRET"]:
                f.write(f"{key}={existing_vars.get(key, '')}\n")

            # Update written keys set
            written_keys = {
                "TAILSCALE_ENABLED",
                "TAILSCALE_IP",
                "HEADSCALE_ENABLED",
                "HEADSCALE_SETUP_MODE",
                "HEADSCALE_DOMAIN",
                "HEADSCALE_SERVER_IP",
                "HEADSCALE_SERVER_URL",
                "HEADSCALE_API_KEY",
                "HEADSCALE_BASE_DOMAIN",
                "NAVIDROME_ENABLED",
                "NAVIDROME_URL",
                "NAVIDROME_USERNAME",
                "NAVIDROME_PASSWORD",
                "JELLYFIN_ENABLED",
                "JELLYFIN_URL",
                "JELLYFIN_USERNAME",
                "JELLYFIN_PASSWORD",
                "SPOTIFY_ENABLED",
                "SPOTIFY_CLIENT_ID",
                "SPOTIFY_CLIENT_SECRET",
                "SLSKD_HOST",
                "SLSKD_USERNAME",
                "SLSKD_PASSWORD",
                "SOULSEEK_USERNAME",
                "SOULSEEK_PASSWORD",
                "HOST_MUSIC_PATH",
                "DOWNLOAD_PATH",
                "COMPLETE_PATH",
                "SCROBBLING_ENABLED",
                "DOWNLOADS_ENABLED",
                "DISCOVERY_ENABLED",
                "LASTFM_API_KEY",
                "LASTFM_SECRET",
            }

            f.write("\n# Other Settings\n")
            for key, value in existing_vars.items():
                if key not in written_keys:
                    f.write(f"{key}={value}\n")

        # Generate slskd.yml from template with Soulseek credentials
        try:
            import os

            # slskd directory is mounted at /app/slskd in the container
            slskd_template_path = str(PROJECT_ROOT / "slskd" / "slskd.yml.template")
            # Write slskd.yml to wizard-config directory
            slskd_config_path = os.path.join(wizard_config_dir, "slskd", "slskd.yml")
            os.makedirs(os.path.dirname(slskd_config_path), exist_ok=True)
            if os.path.exists(slskd_template_path):
                with open(slskd_template_path) as f:
                    template = f.read()
                # Replace placeholders
                config_content = template.replace(
                    "{{SOULSEEK_USERNAME}}", config.soulseek.soulseekUsername or ""
                )
                config_content = config_content.replace(
                    "{{SOULSEEK_PASSWORD}}", config.soulseek.soulseekPassword or ""
                )
                with open(slskd_config_path, "w") as f:
                    f.write(config_content)
                logger.info(f"Generated slskd.yml from template at {slskd_config_path}")
            else:
                logger.warning(
                    f"slskd.yml.template not found at {slskd_template_path}, skipping slskd.yml generation"
                )
        except Exception as e:
            logger.warning(f"Failed to generate slskd.yml: {e}")

        # Generate Headscale config from template if enabled
        if config.headscale.enabled:
            try:
                import os

                # Headscale config template
                headscale_template_path = str(
                    PROJECT_ROOT / "config" / "headscale" / "config.yaml.template"
                )
                headscale_config_dir = os.path.join(
                    wizard_config_dir, "headscale", "config"
                )
                headscale_config_path = os.path.join(
                    headscale_config_dir, "config.yaml"
                )
                os.makedirs(headscale_config_dir, exist_ok=True)

                # Also create data directory for Headscale
                headscale_data_dir = os.path.join(wizard_config_dir, "headscale", "data")
                os.makedirs(headscale_data_dir, exist_ok=True)

                if os.path.exists(headscale_template_path):
                    with open(headscale_template_path) as f:
                        template = f.read()

                    # Replace placeholders
                    config_content = template.replace(
                        "{{HEADSCALE_SERVER_URL}}", config.headscale.serverUrl or ""
                    )
                    config_content = config_content.replace(
                        "{{HEADSCALE_BASE_DOMAIN}}",
                        config.headscale.baseDomain or "headscale.local",
                    )

                    with open(headscale_config_path, "w") as f:
                        f.write(config_content)
                    logger.info(
                        f"Generated Headscale config from template at {headscale_config_path}"
                    )
                else:
                    logger.warning(
                        f"Headscale config template not found at {headscale_template_path}, skipping generation"
                    )
            except Exception as e:
                logger.warning(f"Failed to generate Headscale config: {e}")

        logger.info("Configuration saved successfully")

        # Generate full docker-compose file with user-specified host paths
        try:
            import os

            # Read the template (mounted at /app in container)
            template_path = str(PROJECT_ROOT / f"{DOCKER_COMPOSE_FULL_FILE}.template")
            if os.path.exists(template_path):
                with open(template_path) as f:
                    compose_template = f.read()

                # Replace placeholders with actual paths
                host_music_path = env_vars["HOST_MUSIC_PATH"]
                compose_content = compose_template.replace(
                    "{{HOST_MUSIC_PATH}}", host_music_path
                )

                # Write the full docker-compose file to wizard-config directory
                compose_output_path = os.path.join(
                    wizard_config_dir, DOCKER_COMPOSE_FULL_FILE
                )
                with open(compose_output_path, "w") as f:
                    f.write(compose_content)

                # Create directories with proper permissions
                import os
                import stat

                host_music_path = env_vars["HOST_MUSIC_PATH"]
                download_path = f"{host_music_path}/downloads"
                complete_path = f"{host_music_path}/complete"
                incomplete_path = f"{host_music_path}/incomplete"

                # Create directories if they don't exist
                os.makedirs(download_path, exist_ok=True)
                os.makedirs(complete_path, exist_ok=True)
                os.makedirs(incomplete_path, exist_ok=True)
                os.makedirs(f"{host_music_path}/navidrome", exist_ok=True)
                os.makedirs(f"{host_music_path}/jellyfin/config", exist_ok=True)
                os.makedirs(f"{host_music_path}/jellyfin/cache", exist_ok=True)

                # Set permissions (readable/writable for user and group)
                for path in [
                    host_music_path,
                    download_path,
                    complete_path,
                    incomplete_path,
                ]:
                    os.chmod(
                        path, stat.S_IRWXU | stat.S_IRWXG | stat.S_IROTH | stat.S_IXOTH
                    )
                    for root, dirs, _files in os.walk(path):
                        for d in dirs:
                            dir_path = os.path.join(root, d)
                            os.chmod(
                                dir_path,
                                stat.S_IRWXU
                                | stat.S_IRWXG
                                | stat.S_IROTH
                                | stat.S_IXOTH,
                            )

                logger.info(
                    f"Generated {DOCKER_COMPOSE_FULL_FILE} with user music path: {host_music_path} at {compose_output_path}"
                )

                # Create a startup script in wizard-config directory
                startup_script_path = os.path.join(
                    wizard_config_dir, "start-music-stack.sh"
                )

                # Determine wizard compose file path relative to wizard-config
                # Assumes wizard-config and docker-compose.wizard.yml are in the same parent directory
                wizard_compose_relative = "../docker-compose.wizard.yml"

                startup_script = f"""#!/bin/bash
# Start the NoisePort music stack
# This script should be run from the host system (not inside a container)

SCRIPT_DIR="$( cd "$( dirname "${{BASH_SOURCE[0]}}" )" && pwd )"
COMPOSE_FILE="$SCRIPT_DIR/{DOCKER_COMPOSE_FULL_FILE}"
WIZARD_COMPOSE="$SCRIPT_DIR/{wizard_compose_relative}"

echo "🎵 Starting Music Stack with your configured path..."
echo "📁 Music Base Path: {host_music_path}"
echo "📁 Downloads: {host_music_path}/downloads"
echo "📁 Complete: {host_music_path}/complete"
echo ""
echo "🛑 Stopping wizard container..."
if [ -f "$WIZARD_COMPOSE" ]; then
    docker compose -f "$WIZARD_COMPOSE" down 2>/dev/null || true
else
    echo "⚠️  Wizard compose file not found at $WIZARD_COMPOSE, skipping wizard shutdown"
fi

echo "🚀 Starting full music stack..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "✅ Music stack is starting up!"
echo "🌐 Services will be available at:"
echo "   - Navidrome: http://localhost:4533"
echo "   - Jellyfin: http://localhost:8096"
echo "   - slskd: http://localhost:5030"
echo "   - FastAPI: http://localhost:8010"
echo ""
echo "⏳ Please wait a few moments for services to fully start before accessing them."
echo ""
echo "📋 To view logs: docker compose -f \\"$COMPOSE_FILE\\" logs -f"
echo "🛑 To stop stack: docker compose -f \\"$COMPOSE_FILE\\" down"
"""

                with open(startup_script_path, "w") as f:
                    f.write(startup_script)

                # Make script executable
                os.chmod(
                    startup_script_path,
                    stat.S_IRWXU
                    | stat.S_IRGRP
                    | stat.S_IXGRP
                    | stat.S_IROTH
                    | stat.S_IXOTH,
                )

                logger.info(f"Generated startup script at {startup_script_path}")

            else:
                logger.warning(f"{DOCKER_COMPOSE_FULL_FILE}.template not found")
        except Exception as e:
            logger.warning(f"Failed to generate docker-compose file: {e}")

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "message": "Configuration saved successfully",
                "dockerComposeGenerated": True,
                "configLocation": wizard_config_dir,
                "hostPaths": {
                    "musicPath": env_vars["HOST_MUSIC_PATH"],
                    "downloads": f"{env_vars['HOST_MUSIC_PATH']}/downloads",
                    "complete": f"{env_vars['HOST_MUSIC_PATH']}/complete",
                },
                "nextSteps": [
                    f"Configuration files saved to: {wizard_config_dir}",
                    f"Run '{wizard_config_dir}/start-music-stack.sh' to start all services",
                    "Or use the 'Launch Services' button in the wizard to start containers",
                    "Wait for services to start, then access them at their respective URLs",
                    "Create accounts in Navidrome and Jellyfin",
                    "Return to wizard to configure authentication",
                ],
            },
        )

    except Exception as e:
        logger.error(f"Failed to save configuration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save configuration",
        )


@router.post("/config/validate", response_model=ConfigValidationResponse)
async def validate_configuration(
    config: WizardConfiguration,
) -> ConfigValidationResponse:
    """Validate the configuration."""
    try:
        errors = []

        # Validate music paths
        if not config.musicPaths.hostMusicPath:
            errors.append(
                ValidationError(
                    field="musicPaths.hostMusicPath",
                    message="Host music path is required",
                )
            )

        # Validate Navidrome if enabled
        if config.navidrome.enabled:
            if not config.navidrome.url:
                errors.append(
                    ValidationError(
                        field="navidrome.url",
                        message="Navidrome URL is required when enabled",
                    )
                )
            if not config.navidrome.username:
                errors.append(
                    ValidationError(
                        field="navidrome.username",
                        message="Navidrome username is required when enabled",
                    )
                )
            if not config.navidrome.password:
                errors.append(
                    ValidationError(
                        field="navidrome.password",
                        message="Navidrome password is required when enabled",
                    )
                )

        # Validate Jellyfin if enabled
        if config.jellyfin.enabled:
            if not config.jellyfin.url:
                errors.append(
                    ValidationError(
                        field="jellyfin.url",
                        message="Jellyfin URL is required when enabled",
                    )
                )
            if not config.jellyfin.username:
                errors.append(
                    ValidationError(
                        field="jellyfin.username",
                        message="Jellyfin username is required when enabled",
                    )
                )
            if not config.jellyfin.password:
                errors.append(
                    ValidationError(
                        field="jellyfin.password",
                        message="Jellyfin password is required when enabled",
                    )
                )

        # Validate Spotify if enabled
        if config.spotify.enabled:
            if not config.spotify.clientId:
                errors.append(
                    ValidationError(
                        field="spotify.clientId",
                        message="Spotify Client ID is required when enabled",
                    )
                )
            if not config.spotify.clientSecret:
                errors.append(
                    ValidationError(
                        field="spotify.clientSecret",
                        message="Spotify Client Secret is required when enabled",
                    )
                )

        # Validate Soulseek if enabled
        if config.soulseek.enabled:
            if not config.soulseek.host:
                errors.append(
                    ValidationError(
                        field="soulseek.host",
                        message="Soulseek host is required when enabled",
                    )
                )
            if not config.soulseek.username:
                errors.append(
                    ValidationError(
                        field="soulseek.username",
                        message="Soulseek username is required when enabled",
                    )
                )
            if not config.soulseek.password:
                errors.append(
                    ValidationError(
                        field="soulseek.password",
                        message="Soulseek password is required when enabled",
                    )
                )

        is_valid = len(errors) == 0

        logger.info(
            f"Configuration validation completed: {'valid' if is_valid else 'invalid'}"
        )
        return ConfigValidationResponse(valid=is_valid, errors=errors)

    except Exception as e:
        logger.error(f"Failed to validate configuration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate configuration",
        )


@router.post("/config/test-connection", response_model=ConnectionTestResponse)
def test_connection(request: ConnectionTestRequest) -> ConnectionTestResponse:
    """Test connection to a service (Navidrome, Jellyfin, Spotify, Soulseek)."""
    service = request.service.lower()
    config = request.config

    try:
        # --- NAVIDROME ---
        if service == "navidrome":
            base_url = config.get("url", "").rstrip("/")
            username = config.get("username")
            password = config.get("password")
            client_name = config.get("client_name", "auth-tester")
            version = "1.16.1"

            # Build auth params
            use_token = config.get("use_token", False)

            if use_token:
                salt = "abc123"  # or random string
                token = hashlib.md5((password + salt).encode()).hexdigest()
                auth_params = {"u": username, "t": token, "s": salt}
            else:
                auth_params = {"u": username, "p": password}

            params = {
                **auth_params,
                "v": version,
                "c": client_name,
            }

            try:
                ping_url = f"{base_url}/rest/ping.view"
                resp = requests.get(ping_url, params=params, timeout=5)

                if resp.status_code == 200 and "ok" in resp.text:
                    success = True
                    message = f"Connection successful as {username}"
                else:
                    success = False
                    message = (
                        f"Authentication failed: HTTP {resp.status_code} — {resp.text}"
                    )

            except Exception as e:
                success = False
                message = f"Connection failed: {e}"

            print(success, message)
            return {"success": success, "message": message}
        # --- JELLYFIN ---
        elif service == "jellyfin":
            try:
                headers = {
                    "Authorization": (
                        f'MediaBrowser UserId="{config.get("username")}", '
                        f'Client="SetupWizard", Device="SetupWizard", '
                        f'Token="{config.get("password")}"'
                    )
                }
                resp = requests.get(
                    f"{config.get('url').rstrip('/')}/Users/Me",
                    headers=headers,
                    timeout=5,
                )
                success = resp.status_code == 200
                message = (
                    "Connection successful"
                    if success
                    else f"HTTP {resp.status_code}: {resp.text}"
                )
            except Exception as e:
                success = False
                message = f"Connection failed: {e}"

        # --- SPOTIFY ---
        elif service == "spotify":
            try:
                data = {
                    "grant_type": "client_credentials",
                    "client_id": config.get("clientId"),
                    "client_secret": config.get("clientSecret"),
                }
                resp = requests.post(
                    "https://accounts.spotify.com/api/token", data=data, timeout=5
                )
                success = resp.status_code == 200 and "access_token" in resp.json()
                message = (
                    "Credentials valid"
                    if success
                    else f"HTTP {resp.status_code}: {resp.text}"
                )
            except Exception as e:
                success = False
                message = f"Connection failed: {e}"

        # --- SOULSEEK ---
        elif service == "soulseek":
            try:
                from app.services.slskd_service import SlskdService

                service = SlskdService(
                    host=config.get("host"),
                    username=config.get("username"),
                    password=config.get("password"),
                )
                # Trigger client connection to verify credentials
                _ = service.client

                message = "Connection successful"
                success = True
            except Exception as e:
                success = False
                print(e)
                message = f"Failed to connect to slskd: {e}"

        # --- TAILSCALE ---
        elif service == "tailscale":
            try:
                import subprocess

                # Check if tailscale is installed and running
                result = subprocess.run(
                    ["tailscale", "status", "--json"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                if result.returncode == 0:
                    import json

                    status_data = json.loads(result.stdout)
                    if status_data.get("BackendState") == "Running":
                        success = True
                        self_ip = status_data.get("TailscaleIPs", [])
                        if self_ip:
                            message = f"Tailscale is running. Your IP: {self_ip[0]}"
                        else:
                            message = "Tailscale is running but no IP assigned yet"
                    else:
                        success = False
                        message = f"Tailscale not connected. State: {status_data.get('BackendState', 'Unknown')}"
                else:
                    success = False
                    message = "Tailscale command failed. Make sure it's installed and configured."
            except subprocess.TimeoutExpired:
                success = False
                message = "Tailscale status check timed out"
            except FileNotFoundError:
                success = False
                message = "Tailscale not installed. Please install from https://tailscale.com/download"
            except Exception as e:
                success = False
                message = f"Error checking Tailscale status: {e}"

        # --- UNKNOWN SERVICE ---
        else:
            success = False
            message = f"Unknown service: {service}"

        logger.info(
            f"Connection test for {service}: {'success' if success else 'failed'}"
        )
        return ConnectionTestResponse(success=success, message=message)

    except Exception as e:
        logger.error(f"Failed to test connection: {e}")
        return ConnectionTestResponse(
            success=False, message=f"Connection test failed: {e}"
        )


@router.post("/config/restart-slskd")
async def restart_slskd() -> JSONResponse:
    """Restart the slskd container using ComposeRunner."""
    try:
        runner = ComposeRunner()
        success, message = runner.restart_service("slskd")
        if success:
            logger.info("slskd container restarted successfully")
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "message": "slskd container restarted successfully",
                    "output": message,
                },
            )
        else:
            logger.error(f"Failed to restart slskd container: {message}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "message": "Failed to restart slskd container",
                    "error": message,
                },
            )
    except Exception as e:
        logger.error(f"Failed to restart slskd: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restart slskd container",
        )


@router.post("/config/restart-fastapi")
async def restart_fastapi() -> JSONResponse:
    """Restart the FastAPI container using ComposeRunner."""
    try:
        runner = ComposeRunner()
        success, message = runner.redeploy_service("fastapi")
        if success:
            logger.info("FastAPI container restarted successfully")
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "message": "FastAPI container restarted successfully",
                    "output": message,
                },
            )
        else:
            logger.error(f"Failed to restart FastAPI container: {message}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "message": "Failed to restart FastAPI container",
                    "error": message,
                },
            )
    except Exception as e:
        logger.error(f"Failed to restart FastAPI: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restart FastAPI container",
        )


@router.post("/config/restart-navidrome")
async def restart_navidrome() -> JSONResponse:
    """Restart the Navidrome container using ComposeRunner."""
    try:
        runner = ComposeRunner()
        success, message = runner.restart_service("navidrome")
        if success:
            logger.info("Navidrome container restarted successfully")
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "message": "Navidrome container restarted successfully",
                    "output": message,
                },
            )
        else:
            logger.error(f"Failed to restart Navidrome container: {message}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "message": "Failed to restart Navidrome container",
                    "error": message,
                },
            )
    except Exception as e:
        logger.error(f"Failed to restart Navidrome: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restart Navidrome container",
        )


@router.get("/config/spotify-token")
async def get_spotify_token() -> JSONResponse:
    """Get Spotify access token using stored credentials."""
    try:
        # Read credentials from settings
        client_id = settings.spotify_client_id
        client_secret = settings.spotify_client_secret

        if not client_id or not client_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Spotify credentials not configured. Please configure in the wizard.",
            )

        # Request token from Spotify
        token_url = "https://accounts.spotify.com/api/token"
        data = {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        }

        response = requests.post(token_url, data=data, timeout=10)

        if response.status_code == 200:
            token_data = response.json()
            logger.info("Successfully retrieved Spotify access token")
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "access_token": token_data.get("access_token"),
                    "token_type": token_data.get("token_type", "Bearer"),
                    "expires_in": token_data.get("expires_in", 3600),
                },
            )
        else:
            logger.error(
                f"Failed to get Spotify token: {response.status_code} - {response.text}"
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to retrieve Spotify token: {response.text}",
            )

    except requests.RequestException as e:
        logger.error(f"Request error while getting Spotify token: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to connect to Spotify API",
        )
    except Exception as e:
        logger.error(f"Error getting Spotify token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve Spotify token",
        )


@router.post("/config/launch-services")
async def launch_services() -> JSONResponse:
    """
    Launch the full music stack using compose-runner.

    This endpoint uses Docker-in-Docker with the docker/compose:2 image to launch
    the stack without requiring manual Docker Desktop file sharing configuration.
    """
    # Check if the full docker-compose file exists in wizard-config
    wizard_config_dir = settings.wizard_config_dir
    compose_file_path = os.path.join(wizard_config_dir, DOCKER_COMPOSE_FULL_FILE)

    if not os.path.exists(compose_file_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configuration not saved yet. Please save your configuration first.",
        )

    try:
        # Initialize compose runner
        runner = ComposeRunner()

        # Run preflight checks
        checks_passed, issues = runner.preflight_checks(DOCKER_COMPOSE_FULL_FILE)
        if not checks_passed:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "success": False,
                    "message": "Preflight checks failed",
                    "issues": issues,
                },
            )

        # Validate compose configuration
        config_valid, config_msg = runner.compose_config(DOCKER_COMPOSE_FULL_FILE)
        if not config_valid:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "success": False,
                    "message": "Invalid compose configuration",
                    "error": config_msg,
                },
            )

        # Launch the stack in background thread
        def run_stack():
            try:
                # Write logs to wizard-config directory
                log_file = os.path.join(wizard_config_dir, "launch_services.log")
                success, message = runner.compose_up(
                    compose_file=DOCKER_COMPOSE_FULL_FILE,
                    build=False,
                    detach=True,
                    log_file=log_file,
                )
                if success:
                    logger.info(f"Stack launched successfully: {message}")
                else:
                    logger.error(f"Stack launch failed: {message}")
            except Exception as e:
                logger.error(f"Error launching stack: {e}")

        thread = threading.Thread(target=run_stack, daemon=True)
        thread.start()

        # Get TAILSCALE_IP from .env if available
        tailscale_ip = None
        try:
            env_file_path = os.path.join(wizard_config_dir, ".env")
            with open(env_file_path) as f:
                for line in f:
                    if line.startswith("TAILSCALE_IP="):
                        tailscale_ip = line.strip().split("=", 1)[1]
                        break
        except Exception:
            pass

        def url(ip, port):
            return f"http://{ip}:{port}" if ip else f"http://localhost:{port}"

        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={
                "success": True,
                "message": "Music stack launch started. Use /config/stack-status to check progress.",
                "project": "noiseport",
                "configPath": runner.wizard_config_path,
                "services": {
                    "navidrome": url(tailscale_ip, 4533),
                    "jellyfin": url(tailscale_ip, 8096),
                    "slskd": url(tailscale_ip, 5030),
                    "fastapi": url(tailscale_ip, 8010),
                },
            },
        )
    except Exception as e:
        logger.error(f"Failed to launch services: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to launch services: {str(e)}",
        )


@router.get("/config/stack-status")
async def get_stack_status() -> JSONResponse:
    """
    Get the current status of the music stack.

    Returns detailed information about containers in the 'noiseport' project.
    """
    try:
        runner = ComposeRunner()
        status_info = runner.get_stack_status()

        return JSONResponse(status_code=status.HTTP_200_OK, content=status_info)
    except Exception as e:
        logger.error(f"Failed to get stack status: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "project": "noiseport",
                "services": {},
                "count": 0,
                "error": str(e),
            },
        )


@router.post("/config/stack-stop")
async def stop_stack() -> JSONResponse:
    """
    Stop the music stack.

    This stops all containers in the 'noiseport' project without affecting
    the wizard container.
    """
    try:
        runner = ComposeRunner()
        wizard_config_dir = settings.wizard_config_dir
        compose_file_path = os.path.join(wizard_config_dir, DOCKER_COMPOSE_FULL_FILE)

        # Check if compose file exists
        if not os.path.exists(compose_file_path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Compose file not found. Cannot stop stack.",
            )

        success, message = runner.compose_down(DOCKER_COMPOSE_FULL_FILE)

        if success:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"success": True, "message": message},
            )
        else:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"success": False, "message": message},
            )
    except Exception as e:
        logger.error(f"Failed to stop stack: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stop stack: {str(e)}",
        )


@router.post("/config/stack-pull")
async def pull_stack_images() -> JSONResponse:
    """
    Pull images for the music stack.

    This pre-downloads all required images to speed up the launch process.
    """
    try:
        runner = ComposeRunner()
        wizard_config_dir = settings.wizard_config_dir
        compose_file_path = os.path.join(wizard_config_dir, DOCKER_COMPOSE_FULL_FILE)

        # Check if compose file exists
        if not os.path.exists(compose_file_path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Compose file not found. Cannot pull images.",
            )

        # Pull images in background thread
        def pull_images():
            try:
                success, message = runner.compose_pull(DOCKER_COMPOSE_FULL_FILE)
                if success:
                    logger.info(f"Images pulled successfully: {message}")
                else:
                    logger.error(f"Image pull failed: {message}")
            except Exception as e:
                logger.error(f"Error pulling images: {e}")

        thread = threading.Thread(target=pull_images, daemon=True)
        thread.start()

        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={
                "success": True,
                "message": "Image pull started in background. This may take several minutes.",
            },
        )
    except Exception as e:
        logger.error(f"Failed to start image pull: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start image pull: {str(e)}",
        )


@router.get("/config/launch-status")
async def launch_status() -> JSONResponse:
    """Get the status/log output of the music stack launch."""
    wizard_config_dir = settings.wizard_config_dir
    log_file = os.path.join(wizard_config_dir, "launch_services.log")

    if os.path.exists(log_file):
        with open(log_file) as f:
            log_content = f.read()
        return JSONResponse(
            status_code=status.HTTP_200_OK, content={"log": log_content}
        )
    else:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"log": "No launch log found yet."},
        )


@router.post("/config/restart-containers")
async def restart_containers() -> JSONResponse:
    """Restart development containers for Tailscale integration."""
    try:
        logger.info("Starting container restart for Tailscale integration")

        # Get current compose configuration
        compose_files = get_compose_file_args()

        # First, restart the containers that need Tailscale integration
        containers_to_restart = ["fastapi"]  # Start with FastAPI, add others as needed

        restart_results = []
        for container in containers_to_restart:
            try:
                logger.info(f"Restarting container: {container}")
                cmd = ["docker", "compose"] + compose_files + ["restart", container]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

                if result.returncode == 0:
                    restart_results.append(
                        {
                            "container": container,
                            "status": "success",
                            "message": f"Container {container} restarted successfully",
                        }
                    )
                    logger.info(f"Successfully restarted container: {container}")
                else:
                    restart_results.append(
                        {
                            "container": container,
                            "status": "error",
                            "message": f"Failed to restart {container}: {result.stderr}",
                        }
                    )
                    logger.error(
                        f"Failed to restart container {container}: {result.stderr}"
                    )

            except subprocess.TimeoutExpired:
                restart_results.append(
                    {
                        "container": container,
                        "status": "error",
                        "message": f"Timeout restarting {container}",
                    }
                )
                logger.error(f"Timeout restarting container: {container}")
            except Exception as e:
                restart_results.append(
                    {
                        "container": container,
                        "status": "error",
                        "message": f"Error restarting {container}: Unable to restart container",
                    }
                )
                logger.error(f"Error restarting container {container}: {e}")

        # Check if all restarts were successful
        all_successful = all(
            result["status"] == "success" for result in restart_results
        )

        response_data = {
            "message": "Container restart completed",
            "overall_status": "success" if all_successful else "partial_failure",
            "containers": restart_results,
            "next_steps": [
                "Containers are restarting and will be available shortly",
                "Tailscale integration should now be active",
                "You can test the Tailscale connection again",
            ],
        }

        status_code = (
            status.HTTP_200_OK if all_successful else status.HTTP_207_MULTI_STATUS
        )

        return JSONResponse(status_code=status_code, content=response_data)

    except Exception as e:
        logger.error(f"Failed to restart containers: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "message": "Failed to restart containers",
                "overall_status": "error",
            },
        )


@router.get("/config/docker-events")
async def get_docker_events() -> JSONResponse:
    """Get recent Docker events related to image pulling and container startup."""
    try:
        # Get recent Docker events (last 30 seconds)
        result = subprocess.run(
            [
                "docker",
                "events",
                "--since",
                "30s",
                "--until",
                "0s",
                "--format",
                "{{.Type}}\t{{.Action}}\t{{.Actor.Attributes.name}}\t{{.Time}}",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )

        events = []
        if result.returncode == 0 and result.stdout.strip():
            for line in result.stdout.strip().split("\n"):
                if not line:
                    continue
                parts = line.split("\t")
                if len(parts) >= 3:
                    events.append(
                        {
                            "type": parts[0],
                            "action": parts[1],
                            "name": parts[2] if len(parts) > 2 else "",
                            "timestamp": parts[3] if len(parts) > 3 else "",
                        }
                    )

        return JSONResponse(status_code=status.HTTP_200_OK, content={"events": events})

    except Exception as e:
        logger.error(f"Failed to get Docker events: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "Failed to get Docker events", "events": []},
        )


@router.get("/config/container-logs/{container_name}")
async def get_container_logs(container_name: str) -> JSONResponse:
    """Get recent logs from a specific container."""
    try:
        # Validate container name to prevent command injection
        if container_name not in ALLOWED_CONTAINER_NAMES:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "message": f"Invalid container name. Allowed: {', '.join(ALLOWED_CONTAINER_NAMES)}"
                },
            )

        # Get last 50 lines of logs
        result = subprocess.run(
            ["docker", "logs", "--tail", "50", container_name],
            capture_output=True,
            text=True,
            timeout=10,
        )

        logs = result.stdout + result.stderr  # Docker logs can be in stderr too

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"container": container_name, "logs": logs},
        )

    except subprocess.TimeoutExpired:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "Timeout getting container logs"},
        )
    except Exception as e:
        logger.error(f"Failed to get container logs for {container_name}: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": f"Failed to get container logs: {str(e)}"},
        )


@router.get("/config/service-status")
async def get_service_status() -> JSONResponse:
    """Check the status of all services with detailed state information."""
    try:
        # Get TAILSCALE_IP from .env if available
        tailscale_ip = None
        try:
            with open(".env") as f:
                for line in f:
                    if line.startswith("TAILSCALE_IP="):
                        tailscale_ip = line.strip().split("=", 1)[1]
                        break
        except Exception:
            pass

        def url(ip, port):
            return f"http://{ip}:{port}" if ip else f"http://localhost:{port}"

        services = {
            "navidrome": {
                "running": False,
                "url": url(tailscale_ip, 4533),
                "state": "unknown",
                "status": "",
            },
            "jellyfin": {
                "running": False,
                "url": url(tailscale_ip, 8096),
                "state": "unknown",
                "status": "",
            },
            "slskd": {
                "running": False,
                "url": url(tailscale_ip, 5030),
                "state": "unknown",
                "status": "",
            },
            "fastapi": {
                "running": False,
                "url": url(tailscale_ip, 8000),
                "state": "unknown",
                "status": "",
            },
        }

        # Check running containers with detailed status
        result = subprocess.run(
            ["docker", "ps", "-a", "--format", "{{.Names}}\t{{.State}}\t{{.Status}}"],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode == 0:
            output_lines = result.stdout.strip().split("\n")
            for line in output_lines:
                if not line:
                    continue
                parts = line.split("\t")
                if len(parts) >= 3:
                    container_name = parts[0].lower()
                    state = parts[1].lower()
                    status_text = parts[2]

                    # Determine if running and detailed state
                    is_running = state == "running"
                    detailed_state = "running" if is_running else state

                    if "navidrome" in container_name:
                        services["navidrome"]["running"] = is_running
                        services["navidrome"]["state"] = detailed_state
                        services["navidrome"]["status"] = status_text
                    elif "jellyfin" in container_name:
                        services["jellyfin"]["running"] = is_running
                        services["jellyfin"]["state"] = detailed_state
                        services["jellyfin"]["status"] = status_text
                    elif "slskd" in container_name:
                        services["slskd"]["running"] = is_running
                        services["slskd"]["state"] = detailed_state
                        services["slskd"]["status"] = status_text
                    elif "fastapi" in container_name and "wizard" not in container_name:
                        services["fastapi"]["running"] = is_running
                        services["fastapi"]["state"] = detailed_state
                        services["fastapi"]["status"] = status_text

        # Check if any images are being pulled (look for image pull progress)
        try:
            # Check docker compose ps to see if services are in "creating" state
            compose_args = get_compose_file_args()
            cmd = (
                ["docker", "compose"] + compose_args + ["ps", "-a", "--format", "json"]
            )
            compose_result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=5
            )

            if compose_result.returncode == 0 and compose_result.stdout.strip():
                try:
                    for line in compose_result.stdout.strip().split("\n"):
                        if not line:
                            continue
                        container_info = json.loads(line)
                        service_name = container_info.get("Service", "").lower()
                        state = container_info.get("State", "").lower()

                        if service_name in services:
                            # Update state if it shows creating/restarting
                            if state in ["creating", "restarting"]:
                                services[service_name]["state"] = state
                except json.JSONDecodeError:
                    pass  # Ignore JSON parsing errors
        except Exception:
            pass  # Ignore errors in this additional check

        return JSONResponse(
            status_code=status.HTTP_200_OK, content={"services": services}
        )

    except Exception as e:
        logger.error(f"Failed to check service status: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "Failed to check service status"},
        )
