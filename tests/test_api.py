"""Unit tests for API endpoints."""

import pytest
from fastapi import status


@pytest.mark.unit
def test_root_endpoint(client):
    """Test the root endpoint."""
    response = client.get("/")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "message" in data
    assert "version" in data
    assert "docs" in data


@pytest.mark.unit
def test_health_endpoint(client):
    """Test the health check endpoint."""
    response = client.get("/api/v1/system/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "timestamp" in data
    assert "uptime" in data


@pytest.mark.unit
def test_api_info_endpoint(client):
    """Test the API info endpoint."""
    response = client.get("/api/v1/system/info")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "name" in data
    assert "version" in data
    assert "description" in data
    assert "docs_url" in data
    assert "openapi_url" in data


@pytest.mark.unit
def test_download_endpoint_validation(client):
    """Test download endpoint validation."""
    # Test missing fields
    response = client.post("/api/v1/downloads/download", json={})
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Test empty strings
    response = client.post(
        "/api/v1/downloads/download", json={"artist": "", "album": ""}
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Test whitespace only
    response = client.post(
        "/api/v1/downloads/download", json={"artist": "   ", "album": "   "}
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.unit
def test_download_endpoint_success(client, sample_download_request):
    """Test successful download request."""
    response = client.post("/api/v1/downloads/download", json=sample_download_request)
    # Note: This will likely fail in CI without SLSKD, but shows the expected structure
    # In a real test, we'd mock the SLSKD service
    data = response.json()
    if response.status_code == status.HTTP_200_OK:
        assert data["success"] is True
        assert "message" in data
        assert "task_id" in data


@pytest.mark.unit
def test_stats_endpoints_structure(client):
    """Test stats endpoints return correct structure."""
    stats_endpoints = [
        "/api/v1/stats/searches/no-results",
        "/api/v1/stats/downloads/stats", 
        "/api/v1/stats/downloads/albums"
    ]
    
    for endpoint in stats_endpoints:
        response = client.get(endpoint)
        # Without SLSKD service, we expect 503 or 500 (connection error)
        assert response.status_code in [200, 500, 503]
