"""Configuration API endpoints for the setup wizard."""


import json
import os
import stat
import hashlib
import subprocess
import threading

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from app.core.logging import get_logger
from app.models.config import (
    WizardConfiguration,
    ConfigValidationResponse,
    ConnectionTestRequest,
    ConnectionTestResponse,
    ValidationError,
)
from config import settings


from pydantic import BaseModel
import requests

class ConnectionTestRequest(BaseModel):
    service: str
    config: dict


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str


logger = get_logger(__name__)

router = APIRouter(tags=["Configuration"])


@router.get("/config", response_model=WizardConfiguration)
async def get_current_config() -> WizardConfiguration:
    """Get the current configuration."""
    try:
        # Build configuration from current settings
        config = WizardConfiguration(
            tailscale={
                "enabled": getattr(settings, 'tailscale_enabled', False),
                "ip": getattr(settings, 'tailscale_ip', ''),
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
                "soulseekUsername": getattr(settings, 'soulseek_username', ''),
                "soulseekPassword": getattr(settings, 'soulseek_password', ''),
            },
            musicPaths={
                "hostMusicPath": settings.host_music_path,
            },
            features={
                "scrobbling": settings.scrobbling_enabled,
                "downloads": settings.downloads_enabled,
                "discovery": settings.discovery_enabled,
            },
        )
        
        logger.info("Retrieved current configuration")
        return config
        
    except Exception as e:
        logger.error(f"Failed to get configuration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve configuration"
        )


@router.post("/config")
async def save_configuration(config: WizardConfiguration) -> JSONResponse:
    """Save the configuration to environment file."""
    import os
    print(config)
    try:
        # Convert config to environment variables
        env_vars = {
            # Tailscale
            "TAILSCALE_ENABLED": str(config.tailscale.enabled).lower(),
            "TAILSCALE_IP": config.tailscale.ip,
            
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
        }
        
        # Read existing .env file if it exists
        env_file_path = ".env"
        existing_vars = {}
        
        # Create .env file if it does not exist
        if not os.path.exists(env_file_path):
            if os.path.exists("env.example"):
                with open("env.example", "r") as example_file, open(env_file_path, "w") as env_file:
                    env_file.write(example_file.read())
                logger.info(f"Created new .env file from env.example at {env_file_path}")
            else:
                with open(env_file_path, "w") as f:
                    f.write("# Music Client Configuration\n")
                    f.write("# Generated by Setup Wizard\n\n")
                logger.warning(f"env.example not found. Created a blank .env file at {env_file_path}")
# Before writing .env

        with open(env_file_path, "r") as f:
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
                f.write(f"{key}={existing_vars[key]}\n")
            
            f.write("\n# Navidrome\n")
            for key in ["NAVIDROME_ENABLED", "NAVIDROME_URL", "NAVIDROME_USERNAME", "NAVIDROME_PASSWORD"]:
                f.write(f"{key}={existing_vars[key]}\n")
            
            f.write("\n# Jellyfin\n")
            for key in ["JELLYFIN_ENABLED", "JELLYFIN_URL", "JELLYFIN_USERNAME", "JELLYFIN_PASSWORD"]:
                f.write(f"{key}={existing_vars[key]}\n")
            
            f.write("\n# Spotify\n")
            for key in ["SPOTIFY_ENABLED", "SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"]:
                f.write(f"{key}={existing_vars[key]}\n")
            
            f.write("\n# Soulseek/slskd\n")
            for key in ["SLSKD_HOST", "SLSKD_USERNAME", "SLSKD_PASSWORD", "SOULSEEK_USERNAME", "SOULSEEK_PASSWORD"]:
                f.write(f"{key}={existing_vars[key]}\n")
            
            # Host Paths
            for key in ["HOST_MUSIC_PATH"]:
                f.write(f"{key}={existing_vars[key]}\n")
            
            f.write("\n# Container Paths\n")
            f.write("# Automatically derived from HOST_MUSIC_PATH\n")
            f.write("DOWNLOAD_PATH=/music/downloads\n")
            f.write("COMPLETE_PATH=/music/complete\n")
            
            f.write("\n# Features\n")
            for key in ["SCROBBLING_ENABLED", "DOWNLOADS_ENABLED", "DISCOVERY_ENABLED"]:
                f.write(f"{key}={existing_vars[key]}\n")
            
            # Update written keys set
            written_keys = {
                "TAILSCALE_ENABLED", "TAILSCALE_IP",
                "NAVIDROME_ENABLED", "NAVIDROME_URL", "NAVIDROME_USERNAME", "NAVIDROME_PASSWORD",
                "JELLYFIN_ENABLED", "JELLYFIN_URL", "JELLYFIN_USERNAME", "JELLYFIN_PASSWORD",
                "SPOTIFY_ENABLED", "SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET",
                "SLSKD_HOST", "SLSKD_USERNAME", "SLSKD_PASSWORD", "SOULSEEK_USERNAME", "SOULSEEK_PASSWORD",
                "HOST_MUSIC_PATH", "DOWNLOAD_PATH", "COMPLETE_PATH",
                "SCROBBLING_ENABLED", "DOWNLOADS_ENABLED", "DISCOVERY_ENABLED",
            }
            
            f.write("\n# Other Settings\n")
            for key, value in existing_vars.items():
                if key not in written_keys:
                    f.write(f"{key}={value}\n")
        
        
        # Generate slskd.yml from template with Soulseek credentials
        try:
            import os
            slskd_template_path = "slskd/slskd.yml.template"
            slskd_config_path = "slskd/slskd.yml"
            if os.path.exists(slskd_template_path):
                with open(slskd_template_path, "r") as f:
                    template = f.read()
                # Replace placeholders
                config_content = template.replace("{{SOULSEEK_USERNAME}}", config.soulseek.soulseekUsername or "")
                config_content = config_content.replace("{{SOULSEEK_PASSWORD}}", config.soulseek.soulseekPassword or "")
                with open(slskd_config_path, "w") as f:
                    f.write(config_content)
                logger.info("Generated slskd.yml from template with Soulseek credentials")
            else:
                logger.warning("slskd.yml.template not found, skipping slskd.yml generation")
        except Exception as e:
            logger.warning(f"Failed to generate slskd.yml: {e}")
        
        logger.info("Configuration saved successfully")
        
        # Generate full docker-compose file with user-specified host paths
        try:
            import os
            
            # Read the template
            template_path = "docker-compose.full.yml.template"
            if os.path.exists(template_path):
                with open(template_path, "r") as f:
                    compose_template = f.read()
                
                # Replace placeholders with actual paths
                host_music_path = env_vars["HOST_MUSIC_PATH"]
                compose_content = compose_template.replace(
                    "{{HOST_MUSIC_PATH}}", host_music_path
                )
                
                # Write the full docker-compose file
                with open("docker-compose.full.yml", "w") as f:
                    f.write(compose_content)
                
                # Create directories with proper permissions
                import os
                import stat
                
                host_music_path = env_vars["HOST_MUSIC_PATH"]
                download_path = f"{host_music_path}/downloads"
                complete_path = f"{host_music_path}/complete"
                
                # Create directories if they don't exist
                os.makedirs(download_path, exist_ok=True)
                os.makedirs(complete_path, exist_ok=True)
                os.makedirs(f"{complete_path}/navidrome_data", exist_ok=True)
                os.makedirs(f"{complete_path}/jellyfin_config", exist_ok=True)
                os.makedirs(f"{complete_path}/jellyfin_cache", exist_ok=True)
                
                # Set permissions (readable/writable for user and group)
                for path in [host_music_path, download_path, complete_path]:
                    os.chmod(path, stat.S_IRWXU | stat.S_IRWXG | stat.S_IROTH | stat.S_IXOTH)
                    for root, dirs, files in os.walk(path):
                        for d in dirs:
                            dir_path = os.path.join(root, d)
                            os.chmod(dir_path, stat.S_IRWXU | stat.S_IRWXG | stat.S_IROTH | stat.S_IXOTH)
                
                logger.info(f"Generated docker-compose.full.yml with user music path: {host_music_path}")
                
                # Create a startup script
                startup_script = f"""#!/bin/bash
echo "🎵 Starting Music Stack with your configured path..."
echo "📁 Music Base Path: {host_music_path}"
echo "📁 Downloads: {download_path}"
echo "📁 Complete: {complete_path}"
echo ""
echo "🛑 Stopping wizard container..."
docker compose down

echo "🚀 Starting full music stack..."
docker compose -f docker-compose.full.yml up -d

echo ""
echo "✅ Music stack is starting up!"
echo "🌐 Services will be available at:"
echo "   - Navidrome: http://localhost:4533"
echo "   - Jellyfin: http://localhost:8096"
echo "   - slskd: http://localhost:5030"
echo "   - FastAPI: http://localhost:8000"
echo ""
echo "⏳ Please wait a few moments for services to fully start before accessing them."
"""
                
                with open("start-music-stack.sh", "w") as f:
                    f.write(startup_script)
                
                # Make script executable
                os.chmod("start-music-stack.sh", stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
                
            else:
                logger.warning("docker-compose.full.yml.template not found")
        except Exception as e:
            logger.warning(f"Failed to generate docker-compose file: {e}")
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "message": "Configuration saved successfully",
                "dockerComposeGenerated": True,
                "hostPaths": {
                    "musicPath": env_vars["HOST_MUSIC_PATH"],
                    "downloads": f"{env_vars['HOST_MUSIC_PATH']}/downloads",
                    "complete": f"{env_vars['HOST_MUSIC_PATH']}/complete"
                },
                "nextSteps": [
                    "Run './start-music-stack.sh' to start all services with your configured paths",
                    "Wait for services to start, then access them at their respective URLs",
                    "Create accounts in Navidrome and Jellyfin",
                    "Return to wizard to configure authentication"
                ]
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to save configuration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save configuration"
        )


@router.post("/config/validate", response_model=ConfigValidationResponse)
async def validate_configuration(config: WizardConfiguration) -> ConfigValidationResponse:
    """Validate the configuration."""
    try:
        errors = []
        
        # Validate music paths
        if not config.musicPaths.hostMusicPath:
            errors.append(ValidationError(field="musicPaths.hostMusicPath", message="Host music path is required"))
        
        # Validate Navidrome if enabled
        if config.navidrome.enabled:
            if not config.navidrome.url:
                errors.append(ValidationError(field="navidrome.url", message="Navidrome URL is required when enabled"))
            if not config.navidrome.username:
                errors.append(ValidationError(field="navidrome.username", message="Navidrome username is required when enabled"))
            if not config.navidrome.password:
                errors.append(ValidationError(field="navidrome.password", message="Navidrome password is required when enabled"))
        
        # Validate Jellyfin if enabled
        if config.jellyfin.enabled:
            if not config.jellyfin.url:
                errors.append(ValidationError(field="jellyfin.url", message="Jellyfin URL is required when enabled"))
            if not config.jellyfin.username:
                errors.append(ValidationError(field="jellyfin.username", message="Jellyfin username is required when enabled"))
            if not config.jellyfin.password:
                errors.append(ValidationError(field="jellyfin.password", message="Jellyfin password is required when enabled"))
        
        # Validate Spotify if enabled
        if config.spotify.enabled:
            if not config.spotify.clientId:
                errors.append(ValidationError(field="spotify.clientId", message="Spotify Client ID is required when enabled"))
            if not config.spotify.clientSecret:
                errors.append(ValidationError(field="spotify.clientSecret", message="Spotify Client Secret is required when enabled"))
        
        # Validate Soulseek if enabled
        if config.soulseek.enabled:
            if not config.soulseek.host:
                errors.append(ValidationError(field="soulseek.host", message="Soulseek host is required when enabled"))
            if not config.soulseek.username:
                errors.append(ValidationError(field="soulseek.username", message="Soulseek username is required when enabled"))
            if not config.soulseek.password:
                errors.append(ValidationError(field="soulseek.password", message="Soulseek password is required when enabled"))
        
        is_valid = len(errors) == 0
        
        logger.info(f"Configuration validation completed: {'valid' if is_valid else 'invalid'}")
        return ConfigValidationResponse(valid=is_valid, errors=errors)
        
    except Exception as e:
        logger.error(f"Failed to validate configuration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate configuration"
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
                    message = f"Authentication failed: HTTP {resp.status_code} — {resp.text}"

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
                        f"MediaBrowser UserId=\"{config.get('username')}\", "
                        f"Client=\"SetupWizard\", Device=\"SetupWizard\", "
                        f"Token=\"{config.get('password')}\""
                    )
                }
                resp = requests.get(f"{config.get('url').rstrip('/')}/Users/Me", headers=headers, timeout=5)
                success = resp.status_code == 200
                message = "Connection successful" if success else f"HTTP {resp.status_code}: {resp.text}"
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
                resp = requests.post("https://accounts.spotify.com/api/token", data=data, timeout=5)
                success = resp.status_code == 200 and "access_token" in resp.json()
                message = "Credentials valid" if success else f"HTTP {resp.status_code}: {resp.text}"
            except Exception as e:
                success = False
                message = f"Connection failed: {e}"

        # --- SOULSEEK ---
        elif service == "soulseek":
            try:
                from app.services.slskd_service import SlskdService
                
                service=SlskdService(
                    host=config.get("host"),
                    username=config.get("username"),
                    password=config.get("password"),
                )
                service.client
                
                message = "Connection successful"
                success=True
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
                    timeout=5
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

        logger.info(f"Connection test for {service}: {'success' if success else 'failed'}")
        return ConnectionTestResponse(success=success, message=message)

    except Exception as e:
        logger.error(f"Failed to test connection: {e}")
        return ConnectionTestResponse(success=False, message=f"Connection test failed: {e}")


@router.post("/config/restart-slskd")
async def restart_slskd() -> JSONResponse:
    """Restart the slskd container."""
    try:
        import subprocess
        
        # Try to restart the slskd container using docker compose
        # Use the full docker-compose file if it exists
        compose_args = ["-f", "docker-compose.full.yml"] if os.path.exists("docker-compose.full.yml") else []
        result = subprocess.run(
            ["docker", "compose"] + compose_args + ["restart", "slskd"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            logger.info("slskd container restarted successfully")
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "message": "slskd container restarted successfully",
                    "output": result.stdout
                }
            )
        else:
            logger.error(f"Failed to restart slskd container: {result.stderr}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "message": "Failed to restart slskd container",
                    "error": result.stderr
                }
            )
            
    except subprocess.TimeoutExpired:
        logger.error("slskd restart timed out")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "slskd restart timed out"}
        )
    except Exception as e:
        logger.error(f"Failed to restart slskd: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restart slskd container"
        )



import threading

@router.post("/config/launch-services")
async def launch_services() -> JSONResponse:
    """Launch the full music stack with configured paths asynchronously."""
    import subprocess
    import os
    
    # Check if the full docker-compose file exists
    if not os.path.exists("docker-compose.full.yml"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configuration not saved yet. Please save your configuration first."
        )

    log_file = "launch_services.log"

    def run_stack():
        try:
            with open(log_file, "w") as log:
                if os.path.exists("start-music-stack.sh"):
                    process = subprocess.Popen(["bash", "start-music-stack.sh"], stdout=log, stderr=log)
                else:
                    process = subprocess.Popen(["docker", "compose", "-f", "docker-compose.full.yml", "up", "--build", "-d"], stdout=log, stderr=log)
                process.wait()
        except Exception as e:
            with open(log_file, "a") as log:
                log.write(f"\nERROR: {e}\n")

    # Start the stack in a background thread
    thread = threading.Thread(target=run_stack, daemon=True)
    thread.start()


    # Try to get TAILSCALE_IP from .env
    tailscale_ip = None
    try:
        with open('.env', 'r') as f:
            for line in f:
                if line.startswith('TAILSCALE_IP='):
                    tailscale_ip = line.strip().split('=', 1)[1]
                    break
    except Exception:
        pass

    def url(ip, port):
        return f"http://{ip}:{port}" if ip else f"http://localhost:{port}"

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={
            "message": "Music stack launch started in background. Check progress via /config/launch-status.",
            "logFile": log_file,
            "services": {
                "navidrome": url(tailscale_ip, 4533),
                "jellyfin": url(tailscale_ip, 8096),
                "slskd": url(tailscale_ip, 5030),
                "fastapi": url(tailscale_ip, 8000)
            }
        }
    )

@router.get("/config/launch-status")
async def launch_status() -> JSONResponse:
    """Get the status/log output of the music stack launch."""
    log_file = "launch_services.log"
    if os.path.exists(log_file):
        with open(log_file, "r") as f:
            log_content = f.read()
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"log": log_content}
        )
    else:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"log": "No launch log found yet."}
        )


@router.post("/config/restart-containers")
async def restart_containers() -> JSONResponse:
    """Restart development containers for Tailscale integration."""
    try:        
        logger.info("Starting container restart for Tailscale integration")
        
        # Get current compose configuration
        # Check if we're in dev mode or full mode
        compose_files = []
        if os.path.exists("docker-compose.dev.yml"):
            compose_files = ["-f", "docker-compose.dev.yml"]
        elif os.path.exists("docker-compose.full.yml"):
            compose_files = ["-f", "docker-compose.full.yml"]
        else:
            compose_files = []  # Use default docker-compose.yml
        
        # First, restart the containers that need Tailscale integration
        containers_to_restart = ["fastapi"]  # Start with FastAPI, add others as needed
        
        restart_results = []
        for container in containers_to_restart:
            try:
                logger.info(f"Restarting container: {container}")
                cmd = ["docker", "compose"] + compose_files + ["restart", container]
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode == 0:
                    restart_results.append({
                        "container": container,
                        "status": "success",
                        "message": f"Container {container} restarted successfully"
                    })
                    logger.info(f"Successfully restarted container: {container}")
                else:
                    restart_results.append({
                        "container": container,
                        "status": "error",
                        "message": f"Failed to restart {container}: {result.stderr}"
                    })
                    logger.error(f"Failed to restart container {container}: {result.stderr}")
                    
            except subprocess.TimeoutExpired:
                restart_results.append({
                    "container": container,
                    "status": "error",
                    "message": f"Timeout restarting {container}"
                })
                logger.error(f"Timeout restarting container: {container}")
            except Exception as e:
                restart_results.append({
                    "container": container,
                    "status": "error",
                    "message": f"Error restarting {container}: Unable to restart container"
                })
                logger.error(f"Error restarting container {container}: {e}")
        
        # Check if all restarts were successful
        all_successful = all(result["status"] == "success" for result in restart_results)
        
        response_data = {
            "message": "Container restart completed",
            "overall_status": "success" if all_successful else "partial_failure",
            "containers": restart_results,
            "next_steps": [
                "Containers are restarting and will be available shortly",
                "Tailscale integration should now be active",
                "You can test the Tailscale connection again"
            ]
        }
        
        status_code = status.HTTP_200_OK if all_successful else status.HTTP_207_MULTI_STATUS
        
        return JSONResponse(
            status_code=status_code,
            content=response_data
        )
        
    except Exception as e:
        logger.error(f"Failed to restart containers: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "message": "Failed to restart containers",
                "overall_status": "error"
            }
        )


@router.get("/config/service-status")
async def get_service_status() -> JSONResponse:
    """Check the status of all services."""
    try:        
        # Check which containers are running
        result = subprocess.run(
            ["docker", "ps", "--format", "table {{.Names}}\t{{.Status}}\t{{.Ports}}"],
            capture_output=True,
            text=True,
            timeout=10
        )
        print(result.stdout)

        # Get TAILSCALE_IP from .env if available
        tailscale_ip = None
        try:
            with open('.env', 'r') as f:
                for line in f:
                    if line.startswith('TAILSCALE_IP='):
                        tailscale_ip = line.strip().split('=', 1)[1]
                        break
        except Exception:
            pass

        def url(ip, port):
            return f"http://{ip}:{port}" if ip else f"http://localhost:{port}"

        services = {
            "navidrome": {"running": False, "url": url(tailscale_ip, 4533)},
            "jellyfin": {"running": False, "url": url(tailscale_ip, 8096)},
            "slskd": {"running": False, "url": url(tailscale_ip, 5030)},
            "fastapi": {"running": False, "url": url(tailscale_ip, 8000)}
        }
        
        if result.returncode == 0:
            output_lines = result.stdout.split('\n')
            for line in output_lines:
                if 'navidrome' in line.lower():
                    services["navidrome"]["running"] = True
                elif 'jellyfin' in line.lower():
                    services["jellyfin"]["running"] = True
                elif 'slskd' in line.lower():
                    services["slskd"]["running"] = True
                elif 'fastapi' in line.lower():
                    services["fastapi"]["running"] = True
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"services": services}
        )
        
    except Exception as e:
        logger.error(f"Failed to check service status: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "Failed to check service status"}
        )