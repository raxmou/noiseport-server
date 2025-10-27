"""Compose-runner utility for managing Docker Compose stacks from within a container."""

import os
import socket
import logging
from typing import Dict, List, Optional, Tuple
from pathlib import Path

import docker
from docker.errors import DockerException, NotFound

logger = logging.getLogger(__name__)

# Constants
COMPOSE_IMAGE = "docker/compose:latest"
COMPOSE_PROJECT_NAME = "noiseport"


class ComposeRunner:
    def restart_service(self, service_name: str, compose_file: str = "docker-compose.full.yml") -> Tuple[bool, str]:
        """
        Restart a single service in the stack using docker-compose.
        Args:
            service_name: Name of the service to restart (e.g., 'slskd')
            compose_file: Path to compose file (relative to project root)
        Returns:
            Tuple of (success, message)
        """
        logger.info(f"Restarting service '{service_name}' from {compose_file}")
        args = ['-f', compose_file, '-p', COMPOSE_PROJECT_NAME, 'restart', service_name]
        exit_code, stdout, stderr = self._run_compose_command(args, capture_output=True)
        if exit_code == 0:
            return True, f"Service '{service_name}' restarted successfully"
        else:
            return False, f"Failed to restart service '{service_name}': {stderr}"
    """
    Manages Docker Compose operations from within a container using the docker/compose image.
    
    This class discovers the host path backing the container's /app/workspace mount and
    uses it to run docker-compose commands in the proper context.
    """
    
    def __init__(self):
        """Initialize the ComposeRunner."""
        self.client = docker.from_env()
        self.host_project_path = None
        self.container_id = None
        
    def discover_host_path(self) -> str:
        """
        Discover the host absolute path backing the /app/workspace mount.
        
        Returns:
            str: The host path backing /app/workspace
            
        Raises:
            RuntimeError: If unable to discover the host path
        """
        try:
            # Get container hostname which is typically the container ID
            self.container_id = socket.gethostname()
            
            # Inspect the container to get mount information
            container = self.client.containers.get(self.container_id)
            mounts = container.attrs.get('Mounts', [])
            
            # Find the mount for /app/workspace
            for mount in mounts:
                if mount.get('Destination') == '/app/workspace':
                    host_path = mount.get('Source')
                    if host_path:
                        self.host_project_path = host_path
                        logger.info(f"Discovered host project path: {host_path}")
                        return host_path
            
            # Fallback: try environment variable
            if 'HOST_PROJECT_PATH' in os.environ:
                path = os.environ['HOST_PROJECT_PATH']
                self.host_project_path = path
                logger.info(f"Using host project path from env: {path}")
                return path
                
            raise RuntimeError("Could not discover host project path from mounts or environment")
            
        except NotFound:
            raise RuntimeError(f"Container {self.container_id} not found")
        except DockerException as e:
            raise RuntimeError(f"Docker error while discovering host path: {e}")
    
    def _run_compose_command(
        self,
        compose_args: List[str],
        capture_output: bool = True,
        stream_logs: bool = False
    ) -> Tuple[int, str, str]:
        """
        Run a docker-compose command using the docker/compose:2 image.
        
        Args:
            compose_args: List of arguments to pass to docker-compose
            capture_output: Whether to capture stdout/stderr
            stream_logs: Whether to stream logs in real-time
            
        Returns:
            Tuple of (exit_code, stdout, stderr)
        """
        if not self.host_project_path:
            self.discover_host_path()
        
        # Build the docker run command for compose
        # Mount docker socket and project directory
        volumes = {
            '/var/run/docker.sock': {'bind': '/var/run/docker.sock', 'mode': 'rw'},
            self.host_project_path: {'bind': self.host_project_path, 'mode': 'rw'}
        }
        
        # Set working directory to the host path
        working_dir = self.host_project_path
        
        # Build complete command
        command = compose_args
        
        try:
            # Run the compose container
            container = self.client.containers.run(
                COMPOSE_IMAGE,
                command=command,
                volumes=volumes,
                working_dir=working_dir,
                network_mode='host',
                remove=True,
                detach=not capture_output,
                environment={
                    'COMPOSE_PROJECT_NAME': COMPOSE_PROJECT_NAME
                }
            )
            
            if capture_output:
                # Get output
                output = container.decode('utf-8') if isinstance(container, bytes) else str(container)
                return 0, output, ""
            else:
                return 0, "", ""
                
        except docker.errors.ContainerError as e:
            logger.error(f"Compose command failed: {e}")
            return e.exit_status, "", str(e)
        except Exception as e:
            logger.error(f"Error running compose command: {e}")
            return 1, "", str(e)
    
    def compose_config(self, compose_file: str = "docker-compose.full.yml") -> Tuple[bool, str]:
        """
        Validate compose configuration.
        
        Args:
            compose_file: Path to compose file (relative to project root)
            
        Returns:
            Tuple of (success, message)
        """
        exit_code, stdout, stderr = self._run_compose_command([
            '-f', compose_file,
            'config',
            '--quiet'
        ])
        
        if exit_code == 0:
            return True, "Compose configuration is valid"
        else:
            return False, f"Compose configuration error: {stderr}"
    
    def compose_pull(self, compose_file: str = "docker-compose.full.yml") -> Tuple[bool, str]:
        """
        Pull images for the stack.
        
        Args:
            compose_file: Path to compose file (relative to project root)
            
        Returns:
            Tuple of (success, message)
        """
        logger.info(f"Pulling images for {compose_file}")
        exit_code, stdout, stderr = self._run_compose_command([
            '-f', compose_file,
            '-p', COMPOSE_PROJECT_NAME,
            'pull'
        ])
        
        if exit_code == 0:
            return True, "Images pulled successfully"
        else:
            return False, f"Failed to pull images: {stderr}"
    
    def compose_up(
        self,
        compose_file: str = "docker-compose.full.yml",
        build: bool = False,
        detach: bool = True,
        log_file: str = "launch_services.log"
    ) -> Tuple[bool, str]:
        """
        Bring up the stack and write logs to a file.
        
        Args:
            compose_file: Path to compose file (relative to project root)
            build: Whether to build images before starting
            detach: Whether to run in detached mode
            log_file: Path to log file for service launch logs
        
        Returns:
            Tuple of (success, message)
        """
        logger.info(f"Starting stack from {compose_file}")
        
        args = ['-f', compose_file, '-p', COMPOSE_PROJECT_NAME, 'up']
        if build:
            args.append('--build')
        if detach:
            args.append('-d')
        
        exit_code, stdout, stderr = self._run_compose_command(args, capture_output=True)
        # Write logs to file
        try:
            with open(log_file, "a") as f:
                f.write("==== Service Launch Log ====" + "\n")
                f.write(stdout)
                if stderr:
                    f.write("\n[ERROR]\n" + stderr)
        except Exception as e:
            logger.error(f"Failed to write launch log: {e}")
        
        if exit_code == 0:
            return True, f"Stack started successfully with project name '{COMPOSE_PROJECT_NAME}'. Logs written to {log_file}"
        else:
            return False, f"Failed to start stack: {stderr}. See {log_file} for details."
    
    def compose_down(
        self,
        compose_file: str = "docker-compose.full.yml",
        remove_volumes: bool = False
    ) -> Tuple[bool, str]:
        """
        Bring down the stack.
        
        Args:
            compose_file: Path to compose file (relative to project root)
            remove_volumes: Whether to remove volumes
            
        Returns:
            Tuple of (success, message)
        """
        logger.info(f"Stopping stack from {compose_file}")
        
        # Security: Never stop the wizard itself
        # The wizard runs under a different project name or no project name
        args = ['-f', compose_file, '-p', COMPOSE_PROJECT_NAME, 'down']
        if remove_volumes:
            args.append('-v')
        
        exit_code, stdout, stderr = self._run_compose_command(args)
        
        if exit_code == 0:
            return True, "Stack stopped successfully"
        else:
            return False, f"Failed to stop stack: {stderr}"
    
    def get_stack_status(self) -> Dict[str, any]:
        """
        Get the status of containers in the stack.
        
        Returns:
            Dict with container status information
        """
        try:
            # List containers with the noiseport project label
            containers = self.client.containers.list(
                all=True,
                filters={'label': f'com.docker.compose.project={COMPOSE_PROJECT_NAME}'}
            )
            
            services = {}
            for container in containers:
                service_name = container.labels.get('com.docker.compose.service', 'unknown')
                services[service_name] = {
                    'name': container.name,
                    'status': container.status,
                    'state': container.attrs['State']['Status'],
                    'id': container.short_id
                }
            
            return {
                'project': COMPOSE_PROJECT_NAME,
                'services': services,
                'count': len(services)
            }
        except Exception as e:
            logger.error(f"Error getting stack status: {e}")
            return {
                'project': COMPOSE_PROJECT_NAME,
                'services': {},
                'count': 0,
                'error': str(e)
            }
    
    def preflight_checks(self, compose_file: str = "docker-compose.full.yml") -> Tuple[bool, List[str]]:
        """
        Run preflight checks before launching the stack.
        
        Args:
            compose_file: Path to compose file (relative to project root)
            
        Returns:
            Tuple of (all_passed, list_of_issues)
        """
        issues = []
        
        # Check 1: Can we discover the host path?
        try:
            if not self.host_project_path:
                self.discover_host_path()
        except Exception as e:
            issues.append(f"Cannot discover host project path: {e}")
        
        # Check 2: Does the compose file exist?
        if self.host_project_path:
            compose_path = os.path.join('/app/workspace', compose_file)
            if not os.path.exists(compose_path):
                issues.append(f"Compose file not found: {compose_file}")
        
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
