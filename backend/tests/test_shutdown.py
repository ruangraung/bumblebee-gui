"""What a scan's record says when the scan is cancelled.

Shutdown and deletion both cancel the detached scan task, and the two need
different records: a deleted scan loses its row, while a scan cancelled because
the process stopped has to explain that, or it reads as still running.
"""

import asyncio

from bumblebee_gui import database
from bumblebee_gui import main as gui_main
from bumblebee_gui.models import ScanProfile, ScanRequest, ScanStatus


async def _running_scan_that_blocks(monkeypatch, tmp_path):
    """A running row plus a scan task that only ends when cancelled."""
    await database.init_db()
    scan_id = await database.insert_scan(
        profile=ScanProfile.baseline, status=ScanStatus.running
    )
    started = asyncio.Event()

    async def slow_scan(request, ndjson_path, on_progress=None):
        started.set()
        await asyncio.sleep(60)

    monkeypatch.setattr(gui_main, "run_scan", slow_scan)
    task = asyncio.create_task(
        gui_main._run_scan_background(
            scan_id, ScanRequest(profile=ScanProfile.baseline), tmp_path / "scan.ndjson"
        )
    )
    gui_main._background_tasks[scan_id] = task
    await started.wait()
    return scan_id, task


def test_shutdown_cancellation_records_why_the_scan_stopped(monkeypatch, tmp_path):
    """The row must not read as `running` once the process that ran it is gone."""
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "shutdown.db")
    monkeypatch.setattr(database, "DB_DIR", tmp_path)

    async def scenario():
        scan_id, _ = await _running_scan_that_blocks(monkeypatch, tmp_path)
        await gui_main._drain_background_tasks()
        return await database.get_scan(scan_id)

    try:
        stored = asyncio.run(scenario())
    finally:
        gui_main._background_tasks.clear()

    assert stored is not None
    assert stored.status == ScanStatus.failed
    assert "backend stopped" in (stored.error or "")


def test_cancelling_a_scan_for_deletion_leaves_the_row_for_the_deleter(monkeypatch, tmp_path):
    """Only a shutdown records a failure; a delete removes its own row afterwards."""
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "cancel.db")
    monkeypatch.setattr(database, "DB_DIR", tmp_path)
    monkeypatch.setattr(gui_main, "_shutting_down", False)

    async def scenario():
        scan_id, task = await _running_scan_that_blocks(monkeypatch, tmp_path)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        return await database.get_scan(scan_id)

    stored = asyncio.run(scenario())

    assert stored is not None
    assert stored.status == ScanStatus.running
    assert stored.error is None
