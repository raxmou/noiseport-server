"""Tests for Headscale service."""

from unittest.mock import Mock, patch

import pytest

from app.services.headscale_service import HeadscaleClient


@pytest.mark.unit
def test_headscale_client_initialization():
    """Test Headscale client initialization."""
    client = HeadscaleClient(url="http://headscale:8080", api_key="test-key")
    assert client.url == "http://headscale:8080"
    assert client.api_key == "test-key"
    assert "Authorization" in client.session.headers
    assert client.session.headers["Authorization"] == "Bearer test-key"


@pytest.mark.unit
def test_headscale_client_url_trailing_slash():
    """Test that trailing slash is removed from URL."""
    client = HeadscaleClient(url="http://headscale:8080/", api_key="test-key")
    assert client.url == "http://headscale:8080"


@pytest.mark.unit
@patch("app.services.headscale_service.requests.Session.get")
def test_resolve_username_success(mock_get):
    """Test successful username resolution."""
    # Mock Headscale API response
    mock_response = Mock()
    mock_response.json.return_value = {
        "machines": [
            {
                "id": "1",
                "name": "alice-laptop",
                "ipAddresses": ["100.64.0.1"],
                "user": {"name": "alice@headscale.local"},
            },
            {
                "id": "2",
                "name": "bob-desktop",
                "ipAddresses": ["100.64.0.2"],
                "user": {"name": "bob@headscale.local"},
            },
        ]
    }
    mock_response.raise_for_status = Mock()
    mock_get.return_value = mock_response

    client = HeadscaleClient(url="http://headscale:8080", api_key="test-key")
    username = client.resolve_username("100.64.0.1")

    assert username == "alice@headscale.local"
    mock_get.assert_called_once_with("http://headscale:8080/api/v1/machine")


@pytest.mark.unit
@patch("app.services.headscale_service.requests.Session.get")
def test_resolve_username_not_found(mock_get):
    """Test username resolution when IP not found."""
    mock_response = Mock()
    mock_response.json.return_value = {
        "machines": [
            {
                "id": "1",
                "name": "alice-laptop",
                "ipAddresses": ["100.64.0.1"],
                "user": {"name": "alice@headscale.local"},
            }
        ]
    }
    mock_response.raise_for_status = Mock()
    mock_get.return_value = mock_response

    client = HeadscaleClient(url="http://headscale:8080", api_key="test-key")
    username = client.resolve_username("100.64.0.99")

    assert username is None


@pytest.mark.unit
@patch("app.services.headscale_service.requests.Session.get")
def test_resolve_username_fallback_to_machine_name(mock_get):
    """Test username resolution falls back to machine name if user not available."""
    mock_response = Mock()
    mock_response.json.return_value = {
        "machines": [
            {
                "id": "1",
                "name": "test-machine",
                "ipAddresses": ["100.64.0.5"],
                "user": {},  # Empty user object
            }
        ]
    }
    mock_response.raise_for_status = Mock()
    mock_get.return_value = mock_response

    client = HeadscaleClient(url="http://headscale:8080", api_key="test-key")
    username = client.resolve_username("100.64.0.5")

    assert username == "test-machine"


@pytest.mark.unit
def test_resolve_username_no_config():
    """Test username resolution with no configuration."""
    client = HeadscaleClient(url="", api_key="")
    username = client.resolve_username("100.64.0.1")

    assert username is None


@pytest.mark.unit
@patch("app.services.headscale_service.requests.Session.get")
def test_resolve_username_api_error(mock_get):
    """Test username resolution when API returns error."""
    mock_get.side_effect = Exception("API Error")

    client = HeadscaleClient(url="http://headscale:8080", api_key="test-key")
    username = client.resolve_username("100.64.0.1")

    assert username is None
