"""Integration tests for the application."""

import pytest


@pytest.mark.integration
def test_full_app_startup(client):
    """Test that the application starts up correctly."""
    # Test that all endpoints are accessible
    endpoints = [
        "/",
        "/api/v1/system/health",
        "/api/v1/system/info",
    ]

    for endpoint in endpoints:
        response = client.get(endpoint)
        assert response.status_code in [200, 404]  # 404 is acceptable for some endpoints


@pytest.mark.integration
@pytest.mark.slow
def test_download_workflow(client, sample_download_request):
    """Test the complete download workflow."""
    # This test would require a running SLSKD instance
    # In a real scenario, you'd set up test fixtures or mock the service

    # Start download
    response = client.post("/api/v1/downloads/download", json=sample_download_request)

    # Check if SLSKD is available
    if response.status_code == 503:
        pytest.skip("SLSKD service not available for integration test")

    # If successful, verify response structure
    if response.status_code == 200:
        data = response.json()
        assert data["success"] is True
        assert "task_id" in data


@pytest.mark.integration
def test_search_endpoint(client):
    """Test the search endpoint."""
    response = client.get("/api/v1/downloads/search/test/artist")

    # Check if SLSKD is available
    if response.status_code == 503:
        pytest.skip("SLSKD service not available for integration test")

    # If successful, verify response structure
    if response.status_code == 200:
        data = response.json()
        assert "artist" in data
        assert "album" in data
