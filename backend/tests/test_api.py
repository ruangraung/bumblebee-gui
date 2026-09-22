"""Integration tests for the async scan lifecycle (submit → poll → terminal).

The scan subprocess is stubbed out; these tests verify the API contract:
POST /api/scans returns 202 + a running record, and GET /api/scans/{id}
transitions to completed/failed via the background task. Progress,
cancellation, and Server-Sent Events semantics are covered too.
"""

import asyncio
import aiosqlite
import json
import threading
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from bumblebee_gui import database, scanner
from bumblebee_gui.main import app
from bumblebee_gui.models import ScanProfile, ScanStatus, ScanSummary


@pytest.fixture
def client(monkeypatch, tmp_path):
    # Isolate the DB and scan directory in a temp location.
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(database, "DB_DIR", tmp_path)
    monkeypatch.setattr(scanner, "SCANS_DIR", tmp_path / "scans")
    monkeypatch.setattr(scanner, "BINARY_PATH", "/usr/local/bin/bumblebee")

    # Stub the actual scan execution — no subprocess in tests.
    async def fake_run_scan(request, ndjson_path, on_progress=None):
        return (
            ScanSummary(
                total_packages=2,
                ecosystems_found=1,
                findings_count=1,
                ecosystem_counts={"npm": 2},
            ),
            str(ndjson_path),
        )

    monkeypatch.setattr("bumblebee_gui.main.run_scan", fake_run_scan)

    with TestClient(app) as test_client:
        yield test_client


def test_scanner_endpoint_reports_a_version_or_says_why_not(client):
    """The About panel needs a version or a reason, never a silent blank."""
    body = client.get("/api/scanner").json()

    assert set(body) == {"version", "commit", "error"}
    assert body["version"] is not None or body["error"] is not None


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
    async def failing_run_scan(request, ndjson_path, on_progress=None):
        raise RuntimeError("boom")

    monkeypatch.setattr("bumblebee_gui.main.run_scan", failing_run_scan)

    response = client.post("/api/scans", json={"profile": "baseline"})
    assert response.status_code == 202
    scan_id = response.json()["id"]

    terminal = _wait_for_terminal(client, scan_id)
    assert terminal is not None, "background scan never reached a terminal state"
    assert terminal["status"] == "failed"
    assert terminal["packages_found"] is None
    assert terminal["error"] == "boom"


def test_scan_failure_keeps_the_reason_and_drops_the_usage_dump(client, monkeypatch):
    """A refused flag arrives with the scanner's whole usage block attached.

    The complaint is the reason the scan failed; the usage block is thousands of
    characters that belong in neither the record nor the interface.
    """

    async def failing_run_scan(request, ndjson_path, on_progress=None):
        raise RuntimeError(
            'invalid value "banana" for flag -max-duration: parse error\n'
            "Usage of scan:\n"
            "  -max-duration duration\n"
            "\tmax wall-clock duration for the whole scan (0 = unbounded)"
        )

    monkeypatch.setattr("bumblebee_gui.main.run_scan", failing_run_scan)

    response = client.post("/api/scans", json={"profile": "baseline"})
    scan_id = response.json()["id"]

    terminal = _wait_for_terminal(client, scan_id)
    assert terminal is not None, "background scan never reached a terminal state"
    assert terminal["status"] == "failed"
    assert terminal["error"] == 'invalid value "banana" for flag -max-duration: parse error'
    assert "Usage of" not in terminal["error"]


def test_scan_endpoints_404_for_unknown_scan(client):
    assert client.get("/api/scans/9999").status_code == 404
    assert client.get("/api/scans/9999/packages").status_code == 404
    assert client.get("/api/scans/9999/findings").status_code == 404
    assert client.get("/api/scans/9999/events").status_code == 404


def test_cors_allows_only_local_dev_origins(client):
    # The dev frontend (Vite on :5173) is the only allowed origin.
    allowed = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"

    # Any other origin must not get CORS headers — guards against re-widening to "*".
    blocked = client.get("/api/health", headers={"Origin": "http://evil.example.com"})
    assert "access-control-allow-origin" not in blocked.headers


def test_scan_progress_reports_packages_found(client, monkeypatch, tmp_path):
    """Running scans expose live packages_found; completed scans the final total."""
    release = tmp_path / "release"

    async def slow_run_scan(request, ndjson_path, on_progress=None):
        # Two packages found so far, then wait for the green light.
        Path(ndjson_path).parent.mkdir(parents=True, exist_ok=True)
        with open(ndjson_path, "w", encoding="utf-8") as f:
            f.write('{"record_type": "package", "package_name": "a", "ecosystem": "npm"}\n')
            f.write('{"record_type": "package", "package_name": "b", "ecosystem": "npm"}\n')
        while not release.exists():
            await asyncio.sleep(0.01)
        with open(ndjson_path, "a", encoding="utf-8") as f:
            f.write('{"record_type": "package", "package_name": "c", "ecosystem": "npm"}\n')
        return (
            ScanSummary(
                total_packages=3,
                ecosystems_found=1,
                findings_count=0,
                ecosystem_counts={"npm": 3},
            ),
            str(ndjson_path),
        )

    monkeypatch.setattr("bumblebee_gui.main.run_scan", slow_run_scan)

    response = client.post("/api/scans", json={"profile": "baseline"})
    assert response.status_code == 202
    scan_id = response.json()["id"]

    # While running: poll until the fake has written its two packages.
    running = {"status": "pending", "packages_found": 0}
    for _ in range(200):
        running = client.get(f"/api/scans/{scan_id}").json()
        if running["status"] == "running" and running["packages_found"] == 2:
            break
        time.sleep(0.01)
    assert running["status"] == "running"
    assert running["packages_found"] == 2

    release.touch()
    terminal = _wait_for_terminal(client, scan_id)
    assert terminal is not None
    assert terminal["status"] == "completed"
    assert terminal["packages_found"] == 3


def test_list_scans_includes_packages_found_for_running(client, monkeypatch, tmp_path):
    """The scan LIST reports live packages_found for running scans and the
    final total for completed ones — the dashboard's concurrent-scan view
    depends on it (no per-scan detail requests needed)."""
    release = tmp_path / "release"

    async def slow_run_scan(request, ndjson_path, on_progress=None):
        Path(ndjson_path).parent.mkdir(parents=True, exist_ok=True)
        with open(ndjson_path, "w", encoding="utf-8") as f:
            f.write('{"record_type": "package", "package_name": "a", "ecosystem": "npm"}\n')
            f.write('{"record_type": "package", "package_name": "b", "ecosystem": "npm"}\n')
        while not release.exists():
            await asyncio.sleep(0.01)
        return (
            ScanSummary(
                total_packages=2,
                ecosystems_found=1,
                findings_count=0,
                ecosystem_counts={"npm": 2},
            ),
            str(ndjson_path),
        )

    monkeypatch.setattr("bumblebee_gui.main.run_scan", slow_run_scan)

    response = client.post("/api/scans", json={"profile": "baseline"})
    assert response.status_code == 202
    scan_id = response.json()["id"]

    # While running: the list must expose live progress (2 packages written).
    listed = None
    for _ in range(200):
        rows = client.get("/api/scans").json()
        listed = next((r for r in rows if r["id"] == scan_id), None)
        if listed and listed["status"] == "running" and listed["packages_found"] == 2:
            break
        time.sleep(0.01)
    assert listed is not None, "scan never appeared in the list with live progress"
    assert listed["status"] == "running"
    assert listed["packages_found"] == 2

    release.touch()
    terminal = _wait_for_terminal(client, scan_id)
    assert terminal is not None
    assert terminal["status"] == "completed"

    rows = client.get("/api/scans").json()
    completed = next(r for r in rows if r["id"] == scan_id)
    assert completed["packages_found"] == 2


def test_list_scans_tiebreaks_equal_timestamps_by_id_desc(client):
    """Scan rows with identical timestamps order by id DESC — deterministic
    'latest' semantics for the dashboard under concurrent creation."""

    async def insert_two_with_same_timestamp():
        ts = "2026-08-15T10:00:00+00:00"
        async with aiosqlite.connect(database.DB_PATH) as db:
            for _ in range(2):
                await db.execute(
                    "INSERT INTO scans (timestamp, profile, status) VALUES (?, ?, ?)",
                    (ts, "baseline", "completed"),
                )
            await db.commit()

    asyncio.run(insert_two_with_same_timestamp())

    rows = client.get("/api/scans").json()
    ids = [r["id"] for r in rows[:2]]
    assert ids == sorted(ids, reverse=True), f"expected id DESC, got {ids}"


def test_delete_running_scan_cancels_task_and_cleans_up(client, monkeypatch, tmp_path):
    """Deleting a running scan cancels the background task and removes the file."""
    cancelled = threading.Event()

    async def hanging_run_scan(request, ndjson_path, on_progress=None):
        try:
            Path(ndjson_path).parent.mkdir(parents=True, exist_ok=True)
            with open(ndjson_path, "w", encoding="utf-8") as f:
                f.write('{"record_type": "package", "package_name": "a"}\n')
            await asyncio.sleep(60)
        except asyncio.CancelledError:
            cancelled.set()
            raise
        return None  # pragma: no cover

    monkeypatch.setattr("bumblebee_gui.main.run_scan", hanging_run_scan)

    response = client.post("/api/scans", json={"profile": "deep"})
    assert response.status_code == 202
    scan_id = response.json()["id"]
    assert client.get(f"/api/scans/{scan_id}").json()["status"] == "running"

    deleted = client.delete(f"/api/scans/{scan_id}")
    assert deleted.status_code == 200
    assert client.get(f"/api/scans/{scan_id}").status_code == 404
    assert cancelled.wait(timeout=5), "background task was not cancelled"
    # Partial NDJSON file must be gone too.
    assert list((tmp_path / "scans").glob("*.ndjson")) == []


def test_fail_stale_running_scans(monkeypatch, tmp_path):
    """Startup recovery: rows stuck in 'running' are marked failed, with why."""
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(database, "DB_DIR", tmp_path)

    async def scenario():
        await database.init_db()
        scan_id = await database.insert_scan(ScanProfile.baseline, ScanStatus.running)
        await database.fail_stale_running_scans()
        return await database.get_scan(scan_id)

    recovered = asyncio.run(scenario())
    assert recovered is not None
    assert recovered.status == ScanStatus.failed
    assert recovered.error == database.RESTART_REASON


# ── Server-Sent Events ──────────────────────────────────────────────────────


def _sse_event_names(body: str) -> list[str]:
    return [line[len("event: "):] for line in body.splitlines() if line.startswith("event: ")]


def _sse_data(body: str) -> list[dict]:
    return [json.loads(line[len("data: "):]) for line in body.splitlines() if line.startswith("data: ")]


def test_scan_events_streams_live_progress_and_completion(client, monkeypatch, tmp_path):
    """A live SSE subscriber receives snapshot → progress → completed."""
    release = tmp_path / "release"

    async def streaming_run_scan(request, ndjson_path, on_progress=None):
        if on_progress:
            on_progress(1)
            on_progress(2)
        while not release.exists():
            await asyncio.sleep(0.01)
        return (
            ScanSummary(
                total_packages=2,
                ecosystems_found=1,
                findings_count=0,
                ecosystem_counts={"npm": 2},
            ),
            str(ndjson_path),
        )

    monkeypatch.setattr("bumblebee_gui.main.run_scan", streaming_run_scan)

    scan_id = client.post("/api/scans", json={"profile": "baseline"}).json()["id"]

    # Complete the scan on an independent timer so the stream closes on its own;
    # we assert on the full body rather than incrementally reading lines (which
    # deadlocks with the TestClient's buffered streaming transport).
    threading.Thread(
        target=lambda: (time.sleep(0.5), release.touch()), daemon=True
    ).start()

    with client.stream("GET", f"/api/scans/{scan_id}/events") as r:
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/event-stream")
        body = r.read().decode()

    names = _sse_event_names(body)
    assert names[0] == "snapshot"
    assert "progress" in names
    assert names[-1] == "completed"


def test_scan_events_replays_terminal_state_for_finished_scan(client):
    """Connecting after completion yields a snapshot + completed event, no hang."""
    response = client.post("/api/scans", json={"profile": "baseline", "ecosystems": ["npm"]})
    assert response.status_code == 202
    scan_id = response.json()["id"]

    terminal = _wait_for_terminal(client, scan_id)
    assert terminal is not None, "background scan never reached a terminal state"
    assert terminal["status"] == "completed"

    with client.stream("GET", f"/api/scans/{scan_id}/events") as r:
        assert r.status_code == 200
        body = r.read().decode()

    assert _sse_event_names(body) == ["snapshot", "completed"]


def test_scan_events_deliver_progress_payload(client, monkeypatch, tmp_path):
    """Progress events carry the running package count as a JSON payload."""
    release = tmp_path / "release"

    async def counting_run_scan(request, ndjson_path, on_progress=None):
        if on_progress:
            on_progress(7)
        while not release.exists():
            await asyncio.sleep(0.01)
        return (
            ScanSummary(
                total_packages=7,
                ecosystems_found=1,
                findings_count=0,
                ecosystem_counts={"npm": 7},
            ),
            str(ndjson_path),
        )

    monkeypatch.setattr("bumblebee_gui.main.run_scan", counting_run_scan)

    scan_id = client.post("/api/scans", json={"profile": "baseline"}).json()["id"]
    threading.Thread(
        target=lambda: (time.sleep(0.5), release.touch()), daemon=True
    ).start()

    with client.stream("GET", f"/api/scans/{scan_id}/events") as r:
        body = r.read().decode()

    progress_values = [p["packages_found"] for p in _sse_data(body) if p["type"] == "progress"]
    assert 7 in progress_values


def test_create_scan_refuses_a_root_the_scanner_cannot_read(client):
    response = client.post(
        "/api/scans", json={"profile": "project", "roots": ["/no/such/tree"]}
    )

    assert response.status_code == 422
    assert "reports no packages" in response.json()["detail"]


def test_create_scan_refuses_an_empty_root(client, tmp_path):
    empty = tmp_path / "empty-root"
    empty.mkdir()

    response = client.post(
        "/api/scans", json={"profile": "project", "roots": [str(empty)]}
    )

    assert response.status_code == 422
    assert "is empty" in response.json()["detail"]


def test_create_scan_refuses_every_unreadable_root_at_once(client):
    response = client.post(
        "/api/scans",
        json={"profile": "project", "roots": ["/no/such/tree", "/nor/this/one"]},
    )

    detail = response.json()["detail"]

    assert response.status_code == 422
    assert len(detail.splitlines()) == 2


def test_create_scan_accepts_a_root_it_can_read(client, tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    (root / "package.json").write_text("{}")

    response = client.post(
        "/api/scans", json={"profile": "project", "roots": [str(root)]}
    )

    assert response.status_code == 202


def test_host_directories_reports_the_mount(client, monkeypatch, tmp_path):
    mount = tmp_path / "host"
    project = mount / "projects"
    project.mkdir(parents=True)
    monkeypatch.setattr("bumblebee_gui.main.HOST_MOUNT", mount)

    body = client.get("/api/host-directories").json()

    assert body["mounted"] is True
    assert body["directories"] == [str(project)]


def test_host_directories_reports_an_absent_mount(client, monkeypatch, tmp_path):
    monkeypatch.setattr("bumblebee_gui.main.HOST_MOUNT", tmp_path / "absent")

    body = client.get("/api/host-directories").json()

    assert body["mounted"] is False


def test_host_directories_refuses_a_path_outside_the_mount(client, monkeypatch, tmp_path):
    mount = tmp_path / "host"
    mount.mkdir()
    monkeypatch.setattr("bumblebee_gui.main.HOST_MOUNT", mount)

    response = client.get("/api/host-directories", params={"path": "/etc"})

    assert response.status_code == 400


def test_host_directories_walks_below_the_mount(client, monkeypatch, tmp_path):
    mount = tmp_path / "host"
    inner = mount / "projects" / "api"
    inner.mkdir(parents=True)
    monkeypatch.setattr("bumblebee_gui.main.HOST_MOUNT", mount)

    body = client.get(
        "/api/host-directories", params={"path": str(mount / "projects")}
    ).json()

    assert body["directories"] == [str(inner)]
    assert body["parent"] == str(mount)


def test_exposure_catalog_counts_the_installed_catalogues(client, monkeypatch, tmp_path):
    catalogue = tmp_path / "catalogues"
    catalogue.mkdir()
    (catalogue / "campaign.json").write_text(
        json.dumps({"entries": [{"id": "a", "versions": ["1.0.0", "1.0.1"]}]})
    )
    monkeypatch.setattr("bumblebee_gui.main.THREAT_INTEL_DIR", catalogue)

    body = client.get("/api/exposure-catalog").json()

    assert body == {
        "catalogues": 1,
        "entries": 1,
        "versions": 2,
        "available": True,
    }


def test_exposure_catalog_reports_an_image_without_catalogues(client, monkeypatch, tmp_path):
    monkeypatch.setattr("bumblebee_gui.main.THREAT_INTEL_DIR", tmp_path / "absent")

    body = client.get("/api/exposure-catalog").json()

    assert body["available"] is False
    assert body["versions"] == 0


def test_create_scan_refuses_a_duration_the_scanner_cannot_parse(client):
    """A value the scanner would abort on is refused before a scan is created.

    The scanner exits before walking anything, so the alternative to this
    refusal is a scan that fails and reports no packages.
    """
    response = client.post(
        "/api/scans", json={"profile": "baseline", "max_duration": "banana"}
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "banana" in detail
    assert "30s" in detail


def test_create_scan_accepts_an_empty_duration(client):
    """An empty value leaves the flag off the command line."""
    response = client.post(
        "/api/scans", json={"profile": "baseline", "max_duration": ""}
    )

    assert response.status_code == 202


def test_create_scan_accepts_a_duration_the_scanner_can_parse(client):
    response = client.post(
        "/api/scans", json={"profile": "baseline", "max_duration": "1h30m"}
    )

    assert response.status_code == 202
