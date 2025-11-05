"""Headscale service for VPN user management."""

import requests

from app.core.logging import get_logger
from config import settings

logger = get_logger(__name__)


class HeadscaleClient:
    """Client for interacting with Headscale API."""

    def __init__(self, url: str | None = None, api_key: str | None = None):
        """
        Initialize Headscale client.

        Args:
            url: Headscale API URL (defaults to settings.headscale_url)
            api_key: Headscale API key (defaults to settings.headscale_api_key)
        """
        self.url = (url or settings.headscale_url).rstrip("/")
        self.api_key = api_key or settings.headscale_api_key
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {self.api_key}"})

    def get_machine_by_ip(self, ip_address: str) -> dict | None:
        """
        Get machine information by IP address.

        Args:
            ip_address: The VPN IP address to lookup

        Returns:
            Machine information dict or None if not found
        """
        if not self.url or not self.api_key:
            logger.warning(
                "Headscale URL or API key not configured, cannot resolve username"
            )
            return None

        try:
            # Get all machines from Headscale
            response = self.session.get(f"{self.url}/api/v1/machine")
            response.raise_for_status()
            data = response.json()

            machines = data.get("machines", [])

            # Find machine with matching IP
            for machine in machines:
                ip_addresses = machine.get("ipAddresses", [])
                if ip_address in ip_addresses:
                    return machine

            logger.warning(f"No machine found with IP address: {ip_address}")
            return None

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to query Headscale API: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error querying Headscale: {e}", exc_info=True)
            return None

    def resolve_username(self, ip_address: str) -> str | None:
        """
        Resolve username from VPN IP address.

        Args:
            ip_address: The VPN IP address to lookup

        Returns:
            Username or None if not found
        """
        machine = self.get_machine_by_ip(ip_address)
        if machine:
            # Try to get the username from the machine's user field
            user = machine.get("user", {})
            if isinstance(user, dict):
                username = user.get("name")
                if username:
                    logger.info(f"Resolved IP {ip_address} to username: {username}")
                    return username

            # Fallback to machine name if user not available
            machine_name = machine.get("name")
            if machine_name:
                logger.info(f"Resolved IP {ip_address} to machine name: {machine_name}")
                return machine_name

        return None


# Global Headscale client instance
headscale_client = HeadscaleClient()
