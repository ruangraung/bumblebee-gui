"""A scan whose data file disappeared must not look like a scan that found nothing.

`read_records` returns an empty list when the NDJSON file is absent, and the
read endpoints only checked that the database row carried a path. So a scan whose
file was deleted (data directory moved, disk cleanup, restored database) answered
200 with `[]`, which is indistinguishable from a legitimate empty result.

These tests pin the distinction. An empty file that exists is a real empty result
and must stay 200; a path that no longer resolves is a missing-data error.
"""

import asyncio
import contextlib
import importlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from bumblebee_gui import database
from bumblebee_gui.models import ScanProfile, ScanStatus

app = importlib.import_module("bumblebee_gui.main").app

# The three storage shapes these tests care about.
MISSING_FILE = "missing"
EMPTY_FILE = "empty"
NO_PATH = "no-path"


@contextlib.contextmanager
def seeded_client(tmp_path: Path, monkeypatch, kind: str, name: str):
    """An isolated client with one completed scan in the requested storage shape."""
    monkeypatch.setattr(database, "DB_DIR", tmp_path)
    monkeypatch.setattr(database, "DB_PATH", tmp_path / f"{name}.db")

    recorded: str | None = None
    if kind != NO_PATH:
        path = tmp_path / f"{name}.ndjson"
        if kind == EMPTY_FILE:
            path.write_text("")
        recorded = str(path)

    with TestClient(app) as client:
        scan_id = asyncio.run(
            database.insert_scan(
                ScanProfile.baseline,
                ScanStatus.completed,
                ndjson_path=recorded,
            )
        )
        yield client, scan_id


@pytest.mark.parametrize(
    "endpoint",
    [
        "/api/scans/{id}/packages",
        "/api/scans/{id}/findings",
        "/api/scans/{id}/export?format=csv",
    ],
)
def test_missing_file_reports_missing_data(endpoint, monkeypatch, tmp_path):
    with seeded_client(tmp_path, monkeypatch, MISSING_FILE, "gone") as (client, scan_id):
        response = client.get(endpoint.format(id=scan_id))

    assert response.status_code == 404
    assert "missing" in response.json()["detail"].lower()


def test_present_but_empty_file_stays_a_legitimate_empty_result(monkeypatch, tmp_path):
    with seeded_client(tmp_path, monkeypatch, EMPTY_FILE, "empty") as (client, scan_id):
        packages = client.get(f"/api/scans/{scan_id}/packages")
        findings = client.get(f"/api/scans/{scan_id}/findings")

    assert packages.status_code == 200
    assert packages.json() == []
    assert findings.status_code == 200
    assert findings.json() == []


def test_scan_with_no_recorded_path_still_reports_its_own_error(monkeypatch, tmp_path):
    """The pre-existing 'no data file' contract must not be merged with the new one."""
    with seeded_client(tmp_path, monkeypatch, NO_PATH, "nopath") as (client, scan_id):
        response = client.get(f"/api/scans/{scan_id}/packages")

    assert response.status_code == 404
    assert response.json()["detail"] == "No data file for this scan"
