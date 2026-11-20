"""Session-cookie authentication and the guarded API docs.

When BUMBLEBEE_API_TOKEN is set, a caller exchanges the token for an HttpOnly
session cookie at /api/session, and the cookie (or the token header)
authenticates subsequent /api calls and the Swagger docs. The docs routes live
at the root, so the guard covers them too, not just /api.
"""

import pytest
from bumblebee_gui.main import app
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_session_status_reports_auth_disabled_by_default(client):
    response = client.get("/api/session")
    assert response.status_code == 200
    body = response.json()
    assert body["auth_required"] is False
    assert body["authenticated"] is True


def test_session_status_reports_required_when_token_set(client, monkeypatch):
    monkeypatch.setenv("BUMBLEBEE_API_TOKEN", "lab-secret")
    response = client.get("/api/session")
    assert response.status_code == 200
    body = response.json()
    assert body["auth_required"] is True
    assert body["authenticated"] is False


def test_login_with_correct_token_sets_an_httponly_cookie(client, monkeypatch):
    monkeypatch.setenv("BUMBLEBEE_API_TOKEN", "lab-secret")
    response = client.post("/api/session", headers={"X-Bumblebee-Token": "lab-secret"})
    assert response.status_code == 200
    set_cookie = response.headers.get("set-cookie", "").lower()
    assert "bumblebee_session=" in set_cookie
    assert "httponly" in set_cookie
    assert "samesite=strict" in set_cookie


def test_login_with_wrong_token_is_rejected(client, monkeypatch):
    monkeypatch.setenv("BUMBLEBEE_API_TOKEN", "lab-secret")
    response = client.post("/api/session", headers={"X-Bumblebee-Token": "wrong"})
    assert response.status_code == 401
    assert "bumblebee_session=" not in response.headers.get("set-cookie", "")


def test_session_cookie_authenticates_api_calls(client, monkeypatch):
    monkeypatch.setenv("BUMBLEBEE_API_TOKEN", "lab-secret")
    client.post("/api/session", headers={"X-Bumblebee-Token": "lab-secret"})
    response = client.get("/api/scans")
    assert response.status_code != 401


def test_docs_are_guarded_when_token_set(client, monkeypatch):
    monkeypatch.setenv("BUMBLEBEE_API_TOKEN", "lab-secret")
    assert client.get("/docs").status_code == 401
    assert client.get("/redoc").status_code == 401
    assert client.get("/openapi.json").status_code == 401


def test_docs_are_open_when_no_token_is_configured(client):
    response = client.get("/docs")
    assert response.status_code == 200


def test_docs_are_accessible_with_a_session_cookie(client, monkeypatch):
    monkeypatch.setenv("BUMBLEBEE_API_TOKEN", "lab-secret")
    client.post("/api/session", headers={"X-Bumblebee-Token": "lab-secret"})
    response = client.get("/docs")
    assert response.status_code == 200


def test_logout_clears_the_session_cookie(client, monkeypatch):
    monkeypatch.setenv("BUMBLEBEE_API_TOKEN", "lab-secret")
    client.post("/api/session", headers={"X-Bumblebee-Token": "lab-secret"})
    response = client.delete("/api/session")
    assert response.status_code == 200
    set_cookie = response.headers.get("set-cookie", "").lower()
    assert "bumblebee_session=" in set_cookie
    assert "max-age=0" in set_cookie


def test_session_probe_is_exempt_from_the_guard(client, monkeypatch):
    monkeypatch.setenv("BUMBLEBEE_API_TOKEN", "lab-secret")
    response = client.get("/api/session")
    assert response.status_code == 200
