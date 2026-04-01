"""Tests for health and info endpoints."""

from fastapi.testclient import TestClient
from src.agent import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "uptime" in data


def test_info():
    response = client.get("/info")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "role" in data
    assert "version" in data
