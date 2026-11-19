"""A custom catalogue parse must not stall the rest of the API.

Preparing a scan reads and hashes the catalogue the request named. That work is
synchronous, so running it on the event loop freezes every other endpoint until
it finishes. The parse belongs in a worker thread, leaving the loop free to serve
health, list and history requests while a large catalogue is read.
"""

import asyncio
import importlib
import threading
import time

import pytest

from bumblebee_gui import database, receipt, scanner
from bumblebee_gui.models import ScanProfile, ScanRequest, ScannerInfo

api_module = importlib.import_module("bumblebee_gui.main")


@pytest.fixture
def isolated_storage(monkeypatch, tmp_path):
    monkeypatch.setattr(scanner, "SCANS_DIR", tmp_path / "scans")
    monkeypatch.setattr(database, "DB_DIR", tmp_path)
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    scanner.SCANS_DIR.mkdir()
    return tmp_path


def test_preparing_a_scan_with_a_custom_catalogue_keeps_the_event_loop_free(
    isolated_storage, monkeypatch
):
    catalogue = isolated_storage / "custom.json"
    catalogue.write_text('{"entries": []}')

    async def fake_cli_info():
        return ScannerInfo(version="test", commit="deadbeef")

    monkeypatch.setattr(api_module, "cli_info", fake_cli_info)

    started = threading.Event()
    release = threading.Event()
    parse_end = []

    def slow_counts(files):
        started.set()
        release.wait(timeout=5)
        parse_end.append(time.monotonic())
        return {"catalogues": 1, "entries": 0, "versions": 0, "available": True}

    monkeypatch.setattr(receipt, "catalogue_counts", slow_counts)

    def releaser():
        started.wait(timeout=5)
        time.sleep(0.3)
        release.set()

    threading.Thread(target=releaser, daemon=True).start()

    request = ScanRequest(
        profile=ScanProfile.baseline, exposure_catalog=str(catalogue)
    )
    probe_time = []

    async def probe():
        probe_time.append(time.monotonic())

    async def scenario():
        await database.init_db()
        preparation = asyncio.create_task(api_module._prepare_scan(request))
        watcher = asyncio.create_task(probe())
        await asyncio.gather(preparation, watcher)

    asyncio.run(scenario())

    assert probe_time and parse_end
    assert probe_time[0] < parse_end[0], (
        "the catalogue parse ran on the event loop and stalled every other request"
    )
