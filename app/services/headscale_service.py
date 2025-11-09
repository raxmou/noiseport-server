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
        Get node/machine information by IP address.

        Args:
            ip_address: The VPN IP address to lookup

        Returns:
            Node information dict or None if not found
        """
        if not self.url or not self.api_key:
            logger.warning(
                "Headscale URL or API key not configured, cannot resolve username"
            )
            return None

        try:
            # Get all nodes from Headscale (API v1 uses /node endpoint)
            response = self.session.get(f"{self.url}/api/v1/node")
            response.raise_for_status()
            data = response.json()

            nodes = data.get("nodes", [])

            # Find node with matching IP
            for node in nodes:
                ip_addresses = node.get("ipAddresses", [])
                if ip_address in ip_addresses:
                    return node

            logger.warning(f"No node found with IP address: {ip_address}")
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
        node = self.get_machine_by_ip(ip_address)
        if node:
            # Try to get the username from the node's user field
            user = node.get("user", {})
            if isinstance(user, dict):
                username = user.get("name")
                if username:
                    logger.info(f"Resolved IP {ip_address} to username: {username}")
                    return username

            # Fallback to node name if user not available
            node_name = node.get("name")
            if node_name:
                logger.info(f"Resolved IP {ip_address} to node name: {node_name}")
                return node_name

        return None


# Global Headscale client instance
headscale_client = HeadscaleClient()
