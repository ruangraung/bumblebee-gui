"""Origin and token controls on the API surface.

TrustedHostMiddleware decides which Host names the API answers; the token
middleware decides who may call /api when BUMBLEBEE_API_TOKEN is set. The
defaults keep every documented install path working: localhost and 127.0.0.1
for direct browser use, "backend" for the compose proxy, "testserver" for
Starlette's test client.
"""

import pytest
from bumblebee_gui.main import app
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_default_hosts_are_answered(client):
    response = client.get("/api/scans", headers={"Host": "localhost:8001"})
    assert response.status_code != 400


def test_unknown_host_is_rejected(client):
    response = client.get("/api/scans", headers={"Host": "rebound.example"})
    assert response.status_code == 400


def test_api_routes_answer_without_a_token_when_none_is_configured(client):
    response = client.get("/api/scans", headers={"Host": "localhost:8001"})
    assert response.status_code != 401


def test_missing_token_is_rejected_when_configured(client, monkeypatch):
    monkeypatch.setenv("BUMBLEBEE_API_TOKEN", "lab-secret")
    response = client.get("/api/scans", headers={"Host": "localhost:8001"})
    assert response.status_code == 401


def test_wrong_token_is_rejected(client, monkeypatch):
    monkeypatch.setenv("BUMBLEBEE_API_TOKEN", "lab-secret")
    response = client.get(
        "/api/scans", headers={"Host": "localhost:8001", "X-Bumblebee-Token": "wrong"}
    )
    assert response.status_code == 401


def test_correct_token_is_accepted(client, monkeypatch):
    monkeypatch.setenv("BUMBLEBEE_API_TOKEN", "lab-secret")
    response = client.get(
        "/api/scans",
        headers={"Host": "localhost:8001", "X-Bumblebee-Token": "lab-secret"},
    )
    assert response.status_code != 401


def test_cors_preflight_passes_the_token_gate(client, monkeypatch):
    monkeypatch.setenv("BUMBLEBEE_API_TOKEN", "lab-secret")
    response = client.options(
        "/api/scans",
        headers={
            "Host": "localhost:8001",
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code != 401
