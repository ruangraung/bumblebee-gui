"""Scan output ownership, exercised with an isolated database and fake CLI."""

import asyncio
import importlib
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from bumblebee_gui import database, scanner
from bumblebee_gui.models import ScanProfile, ScanRequest, ScanStatus

api_module = importlib.import_module("bumblebee_gui.main")


@pytest.fixture
def output_storage(monkeypatch, tmp_path):
    class FixedClock:
        @staticmethod
        def now(tz):
            return datetime(2026, 1, 1, tzinfo=timezone.utc)

    monkeypatch.setattr(scanner, "datetime", FixedClock)
    monkeypatch.setattr(scanner, "SCANS_DIR", tmp_path / "scans")
    monkeypatch.setattr(database, "DB_DIR", tmp_path)
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    scanner.SCANS_DIR.mkdir()
    return tmp_path


FAKE_CLI = """\
#!/usr/bin/env python3
import json
import os
from pathlib import Path
import sys
import time

ecosystem = sys.argv[sys.argv.index('--ecosystem') + 1]
sync = Path(os.environ['OUTPUT_TEST_SYNC'])
print(json.dumps({
    'record_type': 'package', 'package_name': ecosystem + '-only',
    'version': '1.0.0', 'ecosystem': ecosystem,
}), flush=True)
(sync / (ecosystem + '.ready')).touch()
for _ in range(1000):
    if (sync / (ecosystem + '.release')).exists():
        break
    time.sleep(0.01)
else:
    raise RuntimeError('test did not release the scanner')
"""


@pytest.fixture
def output_client(output_storage, monkeypatch):
    cli = output_storage / "fake-cli.py"
    cli.write_text(FAKE_CLI)
    cli.chmod(0o755)
    monkeypatch.setattr(scanner, "BINARY_PATH", str(cli))
    monkeypatch.setenv("OUTPUT_TEST_SYNC", str(output_storage))
    with TestClient(api_module.app) as client:
        try:
            yield client
        finally:
            for scan in client.get("/api/scans").json():
                client.delete(f"/api/scans/{scan['id']}")


def _wait_until(predicate):
    for _ in range(300):
        if predicate():
            return
        time.sleep(0.01)
    pytest.fail("scan did not reach the expected state")


def _start_overlapping(client, storage):
    scans = []
    for ecosystem in ("npm", "pypi"):
        response = client.post(
            "/api/scans", json={"profile": "baseline", "ecosystems": [ecosystem]}
        )
        assert response.status_code == 202
        scans.append(response.json())
        _wait_until(lambda: (storage / f"{ecosystem}.ready").exists())
    return scans


def _complete(client, storage, scan, ecosystem):
    (storage / f"{ecosystem}.release").touch()
    endpoint = f"/api/scans/{scan['id']}"
    _wait_until(lambda: client.get(endpoint).json()["status"] != "running")
    assert client.get(endpoint).json()["status"] == "completed"


def _package_names(client, scan):
    response = client.get(f"/api/scans/{scan['id']}/packages")
    assert response.status_code == 200
    return [package["package_name"] for package in response.json()]


def test_same_second_scans_reserve_distinct_files(output_storage):
    first = scanner.generate_ndjson_path(ScanProfile.baseline)
    second = scanner.generate_ndjson_path(ScanProfile.baseline)

    assert first != second
    assert first.is_file() and second.is_file()
    assert first.read_bytes() == second.read_bytes() == b""


def test_reservation_does_not_reuse_a_historical_path(output_storage):
    historical = scanner.SCANS_DIR / "2026-01-01_000000_baseline.ndjson"
    historical.write_text("historical output")

    reserved = scanner.generate_ndjson_path(ScanProfile.baseline)

    assert reserved != historical
    assert historical.read_text() == "historical output"
    assert reserved.is_file()


def test_historical_output_still_reads_exports_and_deletes(output_client):
    historical = scanner.SCANS_DIR / "2026-01-01_000000_baseline.ndjson"
    historical.write_text(
        '{"record_type":"package","package_name":"legacy",'
        '"ecosystem":"npm","version":"1.0.0"}\n'
    )
    scan_id = asyncio.run(database.insert_scan(
        profile=ScanProfile.baseline,
        status=ScanStatus.completed,
        ndjson_path=str(historical),
    ))

    assert _package_names(output_client, {"id": scan_id}) == ["legacy"]
    exported = output_client.get(f"/api/scans/{scan_id}/export?format=json")
    assert exported.status_code == 200
    assert exported.json()["packages"][0]["package_name"] == "legacy"
    assert output_client.delete(f"/api/scans/{scan_id}").status_code == 200
    assert not historical.exists()


def test_overlapping_scans_return_their_own_output(output_client, output_storage):
    first, second = _start_overlapping(output_client, output_storage)
    _complete(output_client, output_storage, first, "npm")
    _complete(output_client, output_storage, second, "pypi")

    assert _package_names(output_client, first) == ["npm-only"]
    assert _package_names(output_client, second) == ["pypi-only"]


def test_deleting_one_scan_preserves_the_other_output(output_client, output_storage):
    first, second = _start_overlapping(output_client, output_storage)
    _complete(output_client, output_storage, first, "npm")
    _complete(output_client, output_storage, second, "pypi")

    assert output_client.delete(f"/api/scans/{first['id']}").status_code == 200
    assert not Path(first["ndjson_path"]).exists()
    assert _package_names(output_client, second) == ["pypi-only"]


def test_cancelling_one_scan_preserves_the_other_run(output_client, output_storage):
    first, second = _start_overlapping(output_client, output_storage)

    assert output_client.delete(f"/api/scans/{first['id']}").status_code == 200
    _complete(output_client, output_storage, second, "pypi")

    assert output_client.get(f"/api/scans/{first['id']}").status_code == 404
    assert not Path(first["ndjson_path"]).exists()
    assert _package_names(output_client, second) == ["pypi-only"]


def test_failed_record_insertion_releases_its_output(output_client, monkeypatch):
    async def refuse_insert(**kwargs):
        assert Path(kwargs["ndjson_path"]).is_file()
        raise RuntimeError("record insertion failed")

    monkeypatch.setattr(api_module, "insert_scan", refuse_insert)

    with pytest.raises(RuntimeError, match="record insertion failed"):
        output_client.post("/api/scans", json={"profile": "baseline"})

    assert list(scanner.SCANS_DIR.iterdir()) == []
    assert asyncio.run(database.get_scans()) == []


def test_failed_record_lookup_cleans_up_before_execution(output_client, monkeypatch):
    async def missing_record(scan_id):
        return None

    monkeypatch.setattr(api_module, "get_scan", missing_record)

    response = output_client.post("/api/scans", json={"profile": "baseline"})

    assert response.status_code == 500
    assert list(scanner.SCANS_DIR.iterdir()) == []
    assert asyncio.run(database.get_scans()) == []


def test_reservation_failure_creates_no_record(output_client, monkeypatch):
    def refuse_output(profile):
        raise OSError("output reservation failed")

    monkeypatch.setattr(api_module, "generate_ndjson_path", refuse_output)

    with pytest.raises(OSError, match="output reservation failed"):
        output_client.post("/api/scans", json={"profile": "baseline"})

    assert asyncio.run(database.get_scans()) == []


def test_cancelled_preparation_recovers_a_committed_record(output_storage, monkeypatch):
    async def scenario():
        await database.init_db()
        committed = asyncio.Event()
        release = asyncio.Event()

        async def insert_then_pause(**kwargs):
            scan_id = await database.insert_scan(**kwargs)
            committed.set()
            await release.wait()
            return scan_id

        monkeypatch.setattr(api_module, "insert_scan", insert_then_pause)
        preparation = asyncio.create_task(
            api_module._prepare_scan(ScanRequest(profile=ScanProfile.baseline))
        )
        await asyncio.wait_for(committed.wait(), timeout=3)
        preparation.cancel()
        await asyncio.sleep(0)
        release.set()
        with pytest.raises(asyncio.CancelledError):
            await preparation
        assert await database.get_scans() == []

    asyncio.run(scenario())
    assert list(scanner.SCANS_DIR.iterdir()) == []
