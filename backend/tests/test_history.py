"""Complete history contracts, using isolated records and result files."""

import asyncio

import pytest
from fastapi.testclient import TestClient

from bumblebee_gui import database
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
