"""Complete history contracts, using isolated records and result files."""

import asyncio

import pytest
from fastapi.testclient import TestClient

from bumblebee_gui import database, scanner
from bumblebee_gui import main
from bumblebee_gui.main import app
from bumblebee_gui.models import ScanProfile, ScanStatus


@pytest.fixture
def history(monkeypatch, tmp_path):
    monkeypatch.setattr(database, "DB_DIR", tmp_path)
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "history.db")
    with TestClient(app) as client:
        async def seed():
            for index in range(125):
                path = tmp_path / f"{index}.ndjson"
                path.write_text("")
                await database.insert_scan(
                    ScanProfile.baseline, ScanStatus.completed, ndjson_path=str(path)
                )
        asyncio.run(seed())
        yield client


def test_history_pages_reach_every_record_with_a_real_total(history):
    ids = []
    for offset, expected_count in ((0, 100), (100, 25), (200, 0)):
        response = history.get(f"/api/scan-history?limit=100&offset={offset}")
        assert response.status_code == 200
        page = response.json()
        assert page["total"] == 125
        assert page["offset"] == offset
        assert page["limit"] == 100
        assert len(page["scans"]) == expected_count
        ids.extend(scan["id"] for scan in page["scans"])
    assert ids == list(range(125, 0, -1))


def test_history_default_page_is_not_the_total(history):
    response = history.get("/api/scan-history")
    assert response.status_code == 200
    page = response.json()
    assert len(page["scans"]) == 20
    assert page["total"] == 125


@pytest.mark.parametrize("query", ["offset=-1", "limit=0", "limit=101"])
def test_history_rejects_invalid_page_bounds(history, query):
    assert history.get(f"/api/scan-history?{query}").status_code == 422


def test_recent_list_contract_is_preserved(history):
    response = history.get("/api/scans")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) == 20


def test_clear_history_removes_every_record_and_owned_file(history):
    root = database.DB_DIR
    response = history.delete("/api/scan-history")
    assert response.status_code == 200
    body = response.json()
    assert sorted(body["deleted_ids"]) == list(range(1, 126))
    assert body["failures"] == []
    assert body["remaining"] == 0
    assert history.get("/api/scan-history").json()["total"] == 0
    assert list(root.glob("*.ndjson")) == []


def test_clear_history_keeps_failed_record_and_continues(history, monkeypatch):
    remove = main.remove_scan_file
    failed_path = database.DB_DIR / "0.ndjson"

    def fail_one(path):
        if path == str(failed_path):
            raise PermissionError("Sample file could not be removed")
        remove(path)

    monkeypatch.setattr(main, "remove_scan_file", fail_one)
    response = history.delete("/api/scan-history")
    assert response.status_code == 200
    body = response.json()
    assert len(body["deleted_ids"]) == 124
    assert 1 not in body["deleted_ids"]
    assert [failure["id"] for failure in body["failures"]] == [1]
    assert body["remaining"] == 1
    assert failed_path.exists()
    assert history.get("/api/scans/1").status_code == 200


def test_clear_history_retains_records_created_after_snapshot(history, monkeypatch):
    cancel = main._cancel_running_scan
    inserted = None
    new_path = database.DB_DIR / "later.ndjson"

    async def insert_during_deletion(scan_id):
        nonlocal inserted
        if inserted is None:
            new_path.write_text("")
            inserted = await database.insert_scan(
                ScanProfile.baseline, ScanStatus.completed, ndjson_path=str(new_path)
            )
        await cancel(scan_id)

    monkeypatch.setattr(main, "_cancel_running_scan", insert_during_deletion)
    response = history.delete("/api/scan-history")
    assert response.status_code == 200
    body = response.json()
    assert len(body["deleted_ids"]) == 125
    assert inserted not in body["deleted_ids"]
    assert body["remaining"] == 1
    assert history.get(f"/api/scans/{inserted}").status_code == 200
    assert new_path.exists()


def test_clear_history_cancels_running_scan_before_removing_output(history, monkeypatch):
    import threading
    started = threading.Event()
    cancelled = threading.Event()
    monkeypatch.setattr(scanner, "SCANS_DIR", database.DB_DIR)

    async def running(request, ndjson_path, on_progress=None):
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            assert ndjson_path.exists()
            cancelled.set()

    monkeypatch.setattr(main, "run_scan", running)
    created = history.post("/api/scans", json={"profile": "baseline"})
    assert created.status_code == 202
    assert started.wait(2)
    response = history.delete("/api/scan-history")
    assert response.status_code == 200
    assert cancelled.is_set()
    assert response.json()["failures"] == []
    assert response.json()["remaining"] == 0
    assert list(database.DB_DIR.glob("*.ndjson")) == []


def test_clear_empty_history_is_idempotent(history):
    assert history.delete("/api/scan-history").status_code == 200
    response = history.delete("/api/scan-history")
    assert response.status_code == 200
    assert response.json() == {"deleted_ids": [], "failures": [], "remaining": 0}
