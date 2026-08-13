"""Integration tests for the async scan lifecycle (submit → poll → terminal).

The scan subprocess is stubbed out; these tests verify the API contract:
POST /api/scans returns 202 + a running record, and GET /api/scans/{id}
transitions to completed/failed via the background task.
"""

import time

import pytest
from fastapi.testclient import TestClient

from bumblebee_gui import database, scanner
from bumblebee_gui.main import app
from bumblebee_gui.models import ScanSummary


@pytest.fixture
def client(monkeypatch, tmp_path):
    # Isolate the DB and scan directory in a temp location.
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(database, "DB_DIR", tmp_path)
    monkeypatch.setattr(scanner, "SCANS_DIR", tmp_path / "scans")
    monkeypatch.setattr(scanner, "BINARY_PATH", "/usr/local/bin/bumblebee")

    # Stub the actual scan execution — no subprocess in tests.
    async def fake_run_scan(request):
        return (
            ScanSummary(
                total_packages=2,
                ecosystems_found=1,
                findings_count=1,
                ecosystem_counts={"npm": 2},
            ),
            str(tmp_path / "scans" / "fake.ndjson"),
        )

    monkeypatch.setattr("bumblebee_gui.main.run_scan", fake_run_scan)

    with TestClient(app) as test_client:
        yield test_client


def _wait_for_terminal(client, scan_id, attempts=50, sleep_s=0.05):
    """Poll until the scan reaches a terminal state; return the record."""
    for _ in range(attempts):
        record = client.get(f"/api/scans/{scan_id}").json()
        if record["status"] in ("completed", "failed"):
            return record
        time.sleep(sleep_s)
    return None


def test_create_scan_returns_running_then_completes(client):
    response = client.post(
        "/api/scans",
        json={"profile": "baseline", "ecosystems": ["npm"], "max_duration": "10m"},
    )
    assert response.status_code == 202
    scan = response.json()
    assert scan["id"] > 0
    assert scan["status"] == "running"
    assert scan["summary"] is None

    terminal = _wait_for_terminal(client, scan["id"])
    assert terminal is not None, "background scan never reached a terminal state"
    assert terminal["status"] == "completed"
    assert terminal["summary"]["total_packages"] == 2
    assert terminal["summary"]["ecosystem_counts"] == {"npm": 2}


def test_create_scan_lists_running_scan(client):
    response = client.post("/api/scans", json={"profile": "project", "roots": ["."]})
    assert response.status_code == 202
    scan_id = response.json()["id"]

    listed = client.get("/api/scans").json()
    ids = [s["id"] for s in listed]
    assert scan_id in ids
    listed_scan = next(s for s in listed if s["id"] == scan_id)
    assert listed_scan["status"] in ("running", "completed")


def test_scan_failure_marks_failed(client, monkeypatch):
    async def failing_run_scan(request):
        raise RuntimeError("boom")

    monkeypatch.setattr("bumblebee_gui.main.run_scan", failing_run_scan)

    response = client.post("/api/scans", json={"profile": "baseline"})
    assert response.status_code == 202
    scan_id = response.json()["id"]

    terminal = _wait_for_terminal(client, scan_id)
    assert terminal is not None, "background scan never reached a terminal state"
    assert terminal["status"] == "failed"


def test_scan_endpoints_404_for_unknown_scan(client):
    assert client.get("/api/scans/9999").status_code == 404
    assert client.get("/api/scans/9999/packages").status_code == 404
    assert client.get("/api/scans/9999/findings").status_code == 404


def test_cors_allows_only_local_dev_origins(client):
    # The dev frontend (Vite on :5173) is the only allowed origin.
    allowed = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"

    # Any other origin must not get CORS headers — guards against re-widening to "*".
    blocked = client.get("/api/health", headers={"Origin": "http://evil.example.com"})
    assert "access-control-allow-origin" not in blocked.headers
