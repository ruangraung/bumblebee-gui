"""A scan that wrote nothing must not be recorded as a completed scan.

`run_scan` treated a zero exit status as success, and an empty stream parses into
zero packages and zero findings, so a replaced or broken CLI produced a scan that
looked clean. The distinction these tests pin: a stream with no records at all is
a failure, while a real scan of an empty tree still emits its scan_summary and
stays a legitimate empty result.
"""

import asyncio
import json

import pytest

from bumblebee_gui import scanner
from bumblebee_gui.models import ScanProfile, ScanRequest

PACKAGE_LINE = json.dumps(
    {"record_type": "package", "name": "left-pad", "ecosystem": "npm"}
)
SUMMARY_LINE = json.dumps(
    {"record_type": "scan_summary", "timed_out": False, "files_considered": 0}
)


class _FakeProcess:
    returncode = 0


class _FakeCli:
    process = _FakeProcess()


def _run_with_stream(monkeypatch, tmp_path, stream: str):
    """Run one scan whose CLI writes the given stream and exits 0."""
    target = tmp_path / "scan.ndjson"
    monkeypatch.setattr(scanner, "ensure_dirs", lambda: None)
    monkeypatch.setattr(scanner, "generate_ndjson_path", lambda profile: target)

    async def fake_spawn(cmd):
        return _FakeCli()

    async def fake_run(cli, ndjson_path, on_progress):
        ndjson_path.write_text(stream)
        return b""

    monkeypatch.setattr(scanner, "_spawn_cli", fake_spawn)
    monkeypatch.setattr(scanner, "_run_cli", fake_run)
    return asyncio.run(scanner.run_scan(ScanRequest(profile=ScanProfile.baseline)))


def test_a_scan_that_wrote_no_records_fails(monkeypatch, tmp_path):
    with pytest.raises(RuntimeError, match="no records"):
        _run_with_stream(monkeypatch, tmp_path, "")


def test_a_scan_that_wrote_only_malformed_lines_fails(monkeypatch, tmp_path):
    with pytest.raises(RuntimeError, match="no records"):
        _run_with_stream(monkeypatch, tmp_path, "{not json\n\n")


def test_a_scan_of_an_empty_tree_still_completes(monkeypatch, tmp_path):
    summary, _ = _run_with_stream(monkeypatch, tmp_path, SUMMARY_LINE)

    assert summary.total_packages == 0
    assert summary.timed_out is False


def test_a_scan_with_records_completes(monkeypatch, tmp_path):
    summary, _ = _run_with_stream(
        monkeypatch, tmp_path, "\n".join([PACKAGE_LINE, SUMMARY_LINE])
    )

    assert summary.total_packages == 1
    assert summary.ecosystem_counts == {"npm": 1}
