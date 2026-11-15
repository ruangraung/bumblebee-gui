"""Concurrency bound on running scans.

``_run_scan_background`` holds one of four semaphore slots for the whole scan,
so a burst of submissions queues instead of running all at once, and every
list request re-reading a running scan's output cannot scale without bound.
"""

import asyncio

import pytest

from bumblebee_gui import main


def test_the_semaphore_caps_concurrent_scans_at_four():
    assert main._scan_slots._value == 4


def test_six_submissions_never_run_more_than_four_at_once(monkeypatch):
    running = 0
    peak = 0

    async def fake_run(request, ndjson_path, on_progress=None):
        nonlocal running, peak
        running += 1
        peak = max(peak, running)
        await asyncio.sleep(0.05)
        running -= 1
        return None

    class FakeRequest:
        pass

    monkeypatch.setattr(main, "run_scan", fake_run)

    async def scenario():
        tasks = [
            asyncio.create_task(main._run_scan_background(index, FakeRequest(), None))
            for index in range(6)
        ]
        await asyncio.gather(*tasks, return_exceptions=True)
        return peak

    peak = asyncio.run(scenario())

    assert peak <= 4


@pytest.fixture(autouse=True)
def quiet_database(monkeypatch, tmp_path):
    """The fake run_scan returns None; the status updates never see real rows."""

    async def noop(*args, **kwargs):
        pass

    for name in ("update_scan_status", "record_scan_failure", "delete_scan"):
        monkeypatch.setattr(main, name, noop)
