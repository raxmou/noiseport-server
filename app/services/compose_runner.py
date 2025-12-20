"""Compose-runner utility for managing Docker Compose stacks from within a container."""

import logging
import os
import socket

import docker
from docker.errors import DockerException, NotFound

from config import settings

logger = logging.getLogger(__name__)

# Constants
COMPOSE_IMAGE = "docker:rc-dind"
COMPOSE_PROJECT_NAME = "noiseport"


class ComposeRunner:
    def _get_platform(self) -> str:
        """Discover the platform string for running containers."""
        try:
            info = self.client.info()
            arch = info.get("Architecture", "arm64")
            os_type = info.get("OSType", "linux")
            return f"{os_type}/{arch}"
        except Exception as e:
            logger.warning(
                f"Could not discover platform, defaulting to linux/arm64: {e}"
            )
            return "linux/arm64"

    def _detect_host_tailscale_ip(self) -> str | None:
        """
        Detect the host machine's Tailscale VPN IP address.
        
        This runs a lightweight container with network_mode='host' to access
        the host's network interfaces and detect the Tailscale IP (100.64.x.x).
        
        Returns:
            The Tailscale IP address or None if not detected
        """
        try:
            # Run a simple Alpine container with host networking to detect IP
            # This container has access to the host's network interfaces
            command = [
                "sh",
                "-c",
                "ip addr show | grep 'inet 100\\.64\\.' | head -n 1 | awk '{print $2}' | cut -d'/' -f1"
            ]
            
            result = self.client.containers.run(
                "alpine:latest",
                command=command,
                network_mode="host",
                remove=True,
                detach=False,
            )
            
            if result:
                ip = result.decode("utf-8").strip()
                if ip and ip.startswith("100.64."):
                    logger.info(f"Detected host Tailscale IP: {ip}")
                    return ip
            
            logger.warning("No Tailscale IP detected on host")
            return None
            
        except Exception as e:
            logger.error(f"Failed to detect Tailscale IP: {e}")
            return None

    def redeploy_service(
        self, service_name: str, compose_file: str = "docker-compose.full.yml"
    ) -> tuple[bool, str]:
        """
        Recreate a single service so updated mounts/files (like .env) are applied.
        """
        logger.info(f"Redeploying service '{service_name}' from {compose_file}")
        args = [
            "-f",
            compose_file,
            "-p",
            COMPOSE_PROJECT_NAME,
            "up",
            "-d",
            "--no-deps",
            "--force-recreate",
            service_name,
        ]
        exit_code, stdout, stderr = self._run_compose_command(args, capture_output=True)
        if exit_code == 0:
            return True, f"Service '{service_name}' redeployed successfully"
        else:
            return False, f"Failed to redeploy service '{service_name}': {stderr}"

    def restart_service(
        self, service_name: str, compose_file: str = "docker-compose.full.yml"
    ) -> tuple[bool, str]:
        """
        Restart a single service in the stack using docker-compose.
        Args:
            service_name: Name of the service to restart (e.g., 'slskd')
            compose_file: Path to compose file (relative to wizard config directory)
        Returns:
            tuple of (success, message)
        """
        logger.info(f"Restarting service '{service_name}' from {compose_file}")
        args = ["-f", compose_file, "-p", COMPOSE_PROJECT_NAME, "restart", service_name]
        exit_code, stdout, stderr = self._run_compose_command(args, capture_output=True)
        if exit_code == 0:
            return True, f"Service '{service_name}' restarted successfully"
        else:
            return False, f"Failed to restart service '{service_name}': {stderr}"

    """
    Manages Docker Compose operations from within a container using the docker/compose image.

    This class uses the wizard config directory to find compose files and run operations.
    """

    def __init__(self):
        """Initialize the ComposeRunner."""
        self.client = docker.from_env()
        self.wizard_config_path = None
        self.container_id = None

    def discover_config_path(self) -> str:
        """
        Discover the host absolute path for the wizard config directory.

        Returns:
            str: The host path to wizard-config directory

        Raises:
            RuntimeError: If unable to discover the config path
        """
        try:
            # Get container hostname which is typically the container ID
            self.container_id = socket.gethostname()

            # Inspect the container to get mount information
            container = self.client.containers.get(self.container_id)
            mounts = container.attrs.get("Mounts", [])

            # Find the mount for /app/wizard-config
            for mount in mounts:
                if mount.get("Destination") == "/app/wizard-config":
                    host_path = mount.get("Source")
                    if host_path:
                        self.wizard_config_path = host_path
                        logger.info(f"Discovered wizard config path: {host_path}")
                        return host_path

            # No mount found - this is an error condition
            raise RuntimeError(
                "Could not discover wizard config path from container mounts. "
                "Ensure /app/wizard-config is mounted in the container. "
                f"Available mounts: {[m.get('Destination') for m in mounts]}"
            )

        except NotFound:
            raise RuntimeError(f"Container {self.container_id} not found")
        except DockerException as e:
            raise RuntimeError(f"Docker error while discovering config path: {e}")

    def _run_compose_command(
        self,
        compose_args: list[str],
        capture_output: bool = True,
        stream_logs: bool = False,
        extra_env: dict | None = None,
    ) -> tuple[int, str, str]:
        """
        Run a docker-compose command using the docker/compose:2 image.

        Args:
            compose_args: list of arguments to pass to docker-compose
            capture_output: Whether to capture stdout/stderr
            stream_logs: Whether to stream logs in real-time
            extra_env: Additional environment variables for docker compose

        Returns:
            tuple of (exit_code, stdout, stderr)
        """
        if not self.wizard_config_path:
            self.discover_config_path()

        # Build the docker run command for compose
        # Mount docker socket and wizard config directory
        volumes = {
            "/var/run/docker.sock": {"bind": "/var/run/docker.sock", "mode": "rw"},
            self.wizard_config_path: {"bind": self.wizard_config_path, "mode": "rw"},
        }
        working_dir = self.wizard_config_path

        # ⬅️ run Docker CLI with the "compose" subcommand
        command = ["compose"] + compose_args

        # Merge environment variables
        env = {"COMPOSE_PROJECT_NAME": COMPOSE_PROJECT_NAME}
        if extra_env:
            env.update(extra_env)

        try:
            platform_str = self._get_platform()
            container = self.client.containers.run(
                COMPOSE_IMAGE,
                command=command,
                volumes=volumes,
                working_dir=working_dir,
                network_mode="host",
                remove=True,
                detach=not capture_output,
                platform=platform_str,
                environment=env,
            )
            if capture_output:
                output = (
                    container.decode("utf-8")
                    if isinstance(container, bytes)
                    else str(container)
                )
                return 0, output, ""
            else:
                return 0, "", ""
        except docker.errors.ContainerError as e:
            logger.error(f"Compose command failed: {e}")
            return e.exit_status, "", str(e)
        except Exception as e:
            logger.error(f"Error running compose command: {e}")
            return 1, "", str(e)

    def compose_config(
        self, compose_file: str = "docker-compose.full.yml"
    ) -> tuple[bool, str]:
        """
        Validate compose configuration.


        Args:
            compose_file: Path to compose file (relative to project root)


        Returns:
            tuple of (success, message)
        """
        exit_code, stdout, stderr = self._run_compose_command(
            ["-f", compose_file, "config", "--quiet"]
        )

        if exit_code == 0:
            return True, "Compose configuration is valid"
        else:
            return False, f"Compose configuration error: {stderr}"

    def compose_pull(
        self, compose_file: str = "docker-compose.full.yml"
    ) -> tuple[bool, str]:
        """
        Pull images for the stack.

        Args:
            compose_file: Path to compose file (relative to project root)

        Returns:
            tuple of (success, message)
        """
        logger.info(f"Pulling images for {compose_file}")
        exit_code, stdout, stderr = self._run_compose_command(
            ["-f", compose_file, "-p", COMPOSE_PROJECT_NAME, "pull"]
        )

        if exit_code == 0:
            return True, "Images pulled successfully"
        else:
            return False, f"Failed to pull images: {stderr}"

    def compose_up(
        self,
        compose_file: str = "docker-compose.full.yml",
        build: bool = False,
        detach: bool = True,
        log_file: str | None = None,
    ) -> tuple[bool, str]:
        """
        Bring up the stack and write logs to a file.

        Args:
            compose_file: Path to compose file (relative to wizard config directory)
            build: Whether to build images before starting
            detach: Whether to run in detached mode
            log_file: Optional absolute path to log file for service launch logs

        Returns:
            tuple of (success, message)
        """
        logger.info(f"Starting stack from {compose_file}")

        # Detect host's Tailscale IP and set as env var
        tailscale_ip = self._detect_host_tailscale_ip()
        env_vars = {"COMPOSE_PROJECT_NAME": COMPOSE_PROJECT_NAME}
        if tailscale_ip:
            logger.info(f"Detected host Tailscale IP: {tailscale_ip}")
            env_vars["TAILSCALE_IP"] = tailscale_ip
        else:
            logger.warning("Could not detect Tailscale IP, services will bind to 127.0.0.1")
            env_vars["TAILSCALE_IP"] = "127.0.0.1"

        args = ["-f", compose_file, "-p", COMPOSE_PROJECT_NAME, "up"]
        if build:
            args.append("--build")
        if detach:
            args.append("-d")

        exit_code, stdout, stderr = self._run_compose_command(
            args, capture_output=True, extra_env=env_vars
        )

        # Write logs to file if path provided
        if log_file:
            try:
                with open(log_file, "a") as f:
                    f.write("==== Service Launch Log ====\n")
                    f.write(f"Tailscale IP: {env_vars.get('TAILSCALE_IP', 'Not detected')}\n")
                    f.write(stdout)
                    if stderr:
                        f.write("\n[ERROR]\n" + stderr)
            except Exception as e:
                logger.error(f"Failed to write launch log: {e}")

        if exit_code == 0:
            message = f"Stack started successfully with project name '{COMPOSE_PROJECT_NAME}'."
            if log_file:
                message += f" Logs written to {log_file}"
            return True, message
        else:
            message = f"Failed to start stack: {stderr}."
            if log_file:
                message += f" See {log_file} for details."
            return False, message

    def compose_down(
        self,
        compose_file: str = "docker-compose.full.yml",
        remove_volumes: bool = False,
    ) -> tuple[bool, str]:
        """
        Bring down the stack.

        Args:
            compose_file: Path to compose file (relative to project root)
            remove_volumes: Whether to remove volumes

        Returns:
            tuple of (success, message)
        """
        logger.info(f"Stopping stack from {compose_file}")

        # Security: Never stop the wizard itself
        # The wizard runs under a different project name or no project name
        args = ["-f", compose_file, "-p", COMPOSE_PROJECT_NAME, "down"]
        if remove_volumes:
            args.append("-v")

        exit_code, stdout, stderr = self._run_compose_command(args)

        if exit_code == 0:
            return True, "Stack stopped successfully"
        else:
            return False, f"Failed to stop stack: {stderr}"

    def get_stack_status(self) -> dict[str, any]:
        """
        Get the status of containers in the stack.

        Returns:
            dict with container status information
        """
        try:
            # list containers with the noiseport project label
            containers = self.client.containers.list(
                all=True,
                filters={"label": f"com.docker.compose.project={COMPOSE_PROJECT_NAME}"},
            )

            services = {}
            for container in containers:
                service_name = container.labels.get(
                    "com.docker.compose.service", "unknown"
                )
                services[service_name] = {
                    "name": container.name,
                    "status": container.status,
                    "state": container.attrs["State"]["Status"],
                    "id": container.short_id,
                }

            return {
                "project": COMPOSE_PROJECT_NAME,
                "services": services,
                "count": len(services),
            }
        except Exception as e:
            logger.error(f"Error getting stack status: {e}")
            return {
                "project": COMPOSE_PROJECT_NAME,
                "services": {},
                "count": 0,
                "error": str(e),
            }

    def preflight_checks(
        self, compose_file: str = "docker-compose.full.yml"
    ) -> tuple[bool, list[str]]:
        """
        Run preflight checks before launching the stack.

        Args:
            compose_file: Path to compose file (relative to wizard config directory)

        Returns:
            tuple of (all_passed, list_of_issues)
        """
        issues = []

        # Check 1: Can we discover the wizard config path?
        try:
            if not self.wizard_config_path:
                self.discover_config_path()
        except Exception as e:
            issues.append(f"Cannot discover wizard config path: {e}")

        # Check 2: Does the compose file exist?
        if self.wizard_config_path:
            # Check in container path first
            container_compose_path = os.path.join(
                settings.wizard_config_dir, compose_file
            )
            if not os.path.exists(container_compose_path):
                issues.append(
                    f"Compose file not found in wizard config: {compose_file}"
                )

        # Check 3: Is Docker socket accessible?
        try:
            self.client.ping()
        except Exception as e:
            issues.append(f"Cannot access Docker daemon: {e}")

        # Check 4: Can we pull the compose image?
        try:
            self.client.images.get(COMPOSE_IMAGE)
        except NotFound:
            try:
                logger.info(f"Pulling {COMPOSE_IMAGE}...")
                self.client.images.pull(COMPOSE_IMAGE)
            except Exception as e:
                issues.append(f"Cannot pull compose image {COMPOSE_IMAGE}: {e}")

        return len(issues) == 0, issues
