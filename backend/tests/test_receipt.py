"""What a scan records about itself.

The point of the receipt is that a result cannot be explained by the current
image: what the scan compared against is written down when it starts. A scan old
enough to predate receipts says unknown rather than borrowing today's catalogues.
"""

import asyncio
import hashlib
import json

import pytest
from fastapi.testclient import TestClient

from bumblebee_gui import database, receipt, scanner
from bumblebee_gui.main import app
from bumblebee_gui.models import ScanProfile, ScanRequest, ScanStatus, ScannerInfo


def _write_catalogue(directory, name="core.json", entries=2):
    """A catalogue file in the shape the counter reads."""
    document = {
        "catalogue": name,
        "entries": [{"name": f"package-{index}", "versions": ["1.0.0", "2.0.0"]} for index in range(entries)],
    }
    path = directory / name
    path.write_text(json.dumps(document))
    return path


def _absent_threat_intel(monkeypatch, tmp_path):
    """Point the bundled catalogue at a directory that does not exist."""
    monkeypatch.setattr(scanner, "THREAT_INTEL_DIR", tmp_path / "no-catalogues-here")


def test_bundled_catalogue_is_recorded_with_digests(monkeypatch, tmp_path):
    threat = tmp_path / "threat-intel"
    threat.mkdir()
    path = _write_catalogue(threat, entries=3)
    monkeypatch.setattr(scanner, "THREAT_INTEL_DIR", threat)

    built = receipt.build_receipt(
        ScanRequest(profile=ScanProfile.baseline),
        ScannerInfo(version="v0.1.3", commit="c1e83c0adb53"),
    )

    assert built.catalogue.mode == "bundled"
    assert built.catalogue.path == str(threat)
    assert built.catalogue.catalogues == 1
    assert built.catalogue.entries == 3
    assert built.catalogue.versions == 6
    assert built.catalogue.digests == {path.name: hashlib.sha256(path.read_bytes()).hexdigest()}
    assert built.exposure_comparison is True
    assert built.scanner_version == "v0.1.3"
    assert built.scanner_commit == "c1e83c0adb53"


def test_custom_catalogue_file_counts_only_that_file(monkeypatch, tmp_path):
    threat = tmp_path / "threat-intel"
    threat.mkdir()
    _write_catalogue(threat, "other.json", entries=9)
    custom = _write_catalogue(tmp_path, "custom.json", entries=4)
    monkeypatch.setattr(scanner, "THREAT_INTEL_DIR", threat)

    built = receipt.build_receipt(
        ScanRequest(profile=ScanProfile.baseline, exposure_catalog=str(custom)),
        ScannerInfo(),
    )

    assert built.catalogue.mode == "custom"
    assert built.catalogue.path == str(custom)
    assert built.catalogue.entries == 4
    assert list(built.catalogue.digests) == ["custom.json"]


def test_disabled_catalogue_records_no_comparison(monkeypatch, tmp_path):
    threat = tmp_path / "threat-intel"
    threat.mkdir()
    _write_catalogue(threat)
    monkeypatch.setattr(scanner, "THREAT_INTEL_DIR", threat)

    built = receipt.build_receipt(
        ScanRequest(profile=ScanProfile.baseline, exposure_catalog=""),
        ScannerInfo(),
    )

    assert built.catalogue.mode == "disabled"
    assert built.catalogue.path is None
    assert built.catalogue.digests == {}
    assert built.exposure_comparison is False


def test_bundled_wanted_but_absent_is_not_a_comparison(monkeypatch, tmp_path):
    """An inventory-only scan must not read as though exposure comparison ran."""
    _absent_threat_intel(monkeypatch, tmp_path)

    built = receipt.build_receipt(ScanRequest(profile=ScanProfile.baseline), ScannerInfo())

    assert built.catalogue.mode == "bundled"
    assert built.catalogue.path is None
    assert built.catalogue.entries == 0
    assert built.exposure_comparison is False


def test_unreadable_catalogue_is_skipped_not_fatal(monkeypatch, tmp_path):
    threat = tmp_path / "threat-intel"
    threat.mkdir()
    good = _write_catalogue(threat, "good.json", entries=2)
    broken = threat / "broken.json"
    broken.write_text("{ not json")
    monkeypatch.setattr(scanner, "THREAT_INTEL_DIR", threat)

    built = receipt.build_receipt(ScanRequest(profile=ScanProfile.baseline), ScannerInfo())

    assert built.catalogue.catalogues == 1
    assert built.catalogue.entries == 2
    assert set(built.catalogue.digests) == {"good.json", "broken.json"}
    assert built.catalogue.digests["good.json"] == hashlib.sha256(good.read_bytes()).hexdigest()


def test_requested_roots_are_recorded_with_their_absolute_form(monkeypatch, tmp_path):
    _absent_threat_intel(monkeypatch, tmp_path)

    built = receipt.build_receipt(
        ScanRequest(profile=ScanProfile.project, roots=["./sub", "/etc"]),
        ScannerInfo(),
    )

    assert built.requested_roots == ["./sub", "/etc"]
    assert built.resolved_roots[0] == str((__import__("pathlib").Path.cwd() / "sub").resolve())
    assert built.resolved_roots[1] == "/etc"


def test_no_requested_roots_leave_the_profile_to_decide(monkeypatch, tmp_path):
    _absent_threat_intel(monkeypatch, tmp_path)

    built = receipt.build_receipt(ScanRequest(profile=ScanProfile.deep), ScannerInfo())

    assert built.requested_roots == []
    assert built.resolved_roots == []


@pytest.mark.parametrize(
    ("requested", "recorded"),
    [(" 30s ", "30s"), ("30s", "30s"), ("   ", None), ("", None)],
)
def test_duration_is_recorded_as_the_scanner_receives_it(monkeypatch, tmp_path, requested, recorded):
    """A padded duration is stripped before the command, so the receipt agrees."""
    _absent_threat_intel(monkeypatch, tmp_path)

    built = receipt.build_receipt(
        ScanRequest(profile=ScanProfile.baseline, max_duration=requested),
        ScannerInfo(),
    )

    assert built.max_duration == recorded


def test_receipt_round_trips_through_the_database(monkeypatch, tmp_path):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "receipt.db")
    monkeypatch.setattr(database, "DB_DIR", tmp_path)
    monkeypatch.setattr(scanner, "THREAT_INTEL_DIR", tmp_path / "no-catalogues-here")

    built = receipt.build_receipt(
        ScanRequest(profile=ScanProfile.baseline, roots=["/srv"], ecosystems=["npm"]),
        ScannerInfo(version="v0.1.3", commit="c1e83c0adb53"),
    )

    async def scenario():
        await database.init_db()
        scan_id = await database.insert_scan(
            profile=ScanProfile.baseline,
            status=ScanStatus.running,
            receipt=built,
        )
        return await database.get_scan(scan_id)

    stored = asyncio.run(scenario())

    assert stored is not None
    assert stored.receipt is not None
    assert stored.receipt.catalogue.mode == "bundled"
    assert stored.receipt.requested_roots == ["/srv"]
    assert stored.receipt.ecosystems == ["npm"]
    assert stored.receipt.scanner_version == "v0.1.3"
    assert stored.receipt.recorded_at == built.recorded_at


def test_scan_without_a_receipt_reads_as_unknown(monkeypatch, tmp_path):
    """Rows written before receipts existed have nothing to rebuild from."""
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "legacy.db")
    monkeypatch.setattr(database, "DB_DIR", tmp_path)

    async def scenario():
        await database.init_db()
        scan_id = await database.insert_scan(profile=ScanProfile.baseline, status=ScanStatus.running)
        return await database.get_scan(scan_id)

    stored = asyncio.run(scenario())

    assert stored is not None
    assert stored.receipt is None


def test_unreadable_receipt_json_reads_as_unknown(monkeypatch, tmp_path):
    """A damaged column says unknown instead of raising on every scan read."""
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "damaged.db")
    monkeypatch.setattr(database, "DB_DIR", tmp_path)

    async def scenario():
        await database.init_db()
        scan_id = await database.insert_scan(profile=ScanProfile.baseline, status=ScanStatus.running)
        async with aiosqlite.connect(database.DB_PATH) as db:
            await db.execute("UPDATE scans SET receipt = ? WHERE id = ?", ("{ not json", scan_id))
            await db.commit()
        return await database.get_scan(scan_id)

    import aiosqlite

    stored = asyncio.run(scenario())

    assert stored is not None
    assert stored.receipt is None


def test_export_carries_the_receipt(monkeypatch, tmp_path):
    """An export has to explain itself too, not just the API."""
    from bumblebee_gui.exporters import ExportPayload, render_json_export
    from bumblebee_gui.models import ScanRecord, ScanStatus
    from datetime import datetime, timezone

    _absent_threat_intel(monkeypatch, tmp_path)
    built = receipt.build_receipt(ScanRequest(profile=ScanProfile.baseline), ScannerInfo())

    scan = ScanRecord(
        id=1,
        timestamp=datetime.now(timezone.utc),
        profile=ScanProfile.baseline,
        status=ScanStatus.completed,
        receipt=built,
    )
    rendered = json.loads(render_json_export(ExportPayload(scan=scan, packages=[], findings=[])))

    assert rendered["scan"]["receipt"]["catalogue"]["mode"] == "bundled"
    assert rendered["scan"]["receipt"]["exposure_comparison"] is False


def test_api_scan_carries_the_receipt_it_ran_with(monkeypatch, tmp_path):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "api.db")
    monkeypatch.setattr(database, "DB_DIR", tmp_path)
    monkeypatch.setattr(scanner, "SCANS_DIR", tmp_path / "scans")
    monkeypatch.setattr(scanner, "BINARY_PATH", str(tmp_path / "no-such-binary"))
    monkeypatch.setattr(scanner, "THREAT_INTEL_DIR", tmp_path / "no-catalogues-here")

    async def fake_run_scan(request, ndjson_path, on_progress=None):
        return (
            database.ScanSummary(
                total_packages=0,
                ecosystems_found=0,
                findings_count=0,
                ecosystem_counts={},
                files_considered=0,
            ),
            None,
        )

    monkeypatch.setattr("bumblebee_gui.main.run_scan", fake_run_scan, raising=False)
    monkeypatch.setattr(scanner, "run_scan", fake_run_scan)

    with TestClient(app) as client:
        created = client.post(
            "/api/scans",
            json={"profile": "baseline", "roots": [str(tmp_path)], "max_duration": " 45s "},
        )
        assert created.status_code == 202
        scan = client.get(f"/api/scans/{created.json()['id']}").json()

    assert scan["receipt"] is not None
    assert scan["receipt"]["profile"] == "baseline"
    assert scan["receipt"]["requested_roots"] == [str(tmp_path)]
    assert scan["receipt"]["resolved_roots"] == [str(tmp_path)]
    assert scan["receipt"]["max_duration"] == "45s"
    assert scan["receipt"]["catalogue"]["mode"] == "bundled"
    assert scan["receipt"]["exposure_comparison"] is False
