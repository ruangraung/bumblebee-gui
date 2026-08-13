"""Tests for scanner.py — pure functions and record mapping.

Safety-net slice (landed before the background-scan async refactor):
covers command building, NDJSON parsing, summary calculation, and the
NDJSON→Pydantic record mapping without touching the subprocess path.
"""

import asyncio
import json
import re

from bumblebee_gui import scanner
from bumblebee_gui.models import ScanProfile, ScanRequest

BIN = "/usr/local/bin/bumblebee"


# ── build_command ────────────────────────────────────────────────────────────


def test_build_command_default(monkeypatch):
    monkeypatch.setattr(scanner, "BINARY_PATH", BIN)
    cmd = scanner.build_command(ScanRequest(profile=ScanProfile.baseline))
    assert cmd == [BIN, "scan", "--profile", "baseline", "--max-duration", "10m"]


def test_build_command_all_options(monkeypatch):
    monkeypatch.setattr(scanner, "BINARY_PATH", BIN)
    req = ScanRequest(
        profile=ScanProfile.deep,
        ecosystems=["npm", "pypi"],
        roots=["."],
        exposure_catalog="supply-chain",
        findings_only=True,
        max_duration="5m",
    )
    cmd = scanner.build_command(req)
    assert cmd == [
        BIN,
        "scan",
        "--profile",
        "deep",
        "--ecosystem",
        "npm",
        "--ecosystem",
        "pypi",
        "--root",
        ".",
        "--exposure-catalog",
        "supply-chain",
        "--findings-only",
        "--max-duration",
        "5m",
    ]


def test_build_command_no_optional_flags(monkeypatch):
    monkeypatch.setattr(scanner, "BINARY_PATH", BIN)
    req = ScanRequest(
        profile=ScanProfile.project,
        ecosystems=None,
        roots=None,
        exposure_catalog=None,
        findings_only=False,
        max_duration=None,
    )
    cmd = scanner.build_command(req)
    assert cmd == [BIN, "scan", "--profile", "project"]


def test_build_command_multiple_roots(monkeypatch):
    monkeypatch.setattr(scanner, "BINARY_PATH", BIN)
    cmd = scanner.build_command(ScanRequest(profile=ScanProfile.project, roots=["a", "b", "c"]))
    assert cmd == [
        BIN,
        "scan",
        "--profile",
        "project",
        "--root",
        "a",
        "--root",
        "b",
        "--root",
        "c",
        "--max-duration",
        "10m",
    ]


# ── generate_ndjson_path ─────────────────────────────────────────────────────


def test_generate_ndjson_path_pattern(monkeypatch, tmp_path):
    monkeypatch.setattr(scanner, "SCANS_DIR", tmp_path)
    path = scanner.generate_ndjson_path(ScanProfile.baseline)
    assert path.parent == tmp_path
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}_\d{6}_baseline\.ndjson", path.name)


def test_generate_ndjson_path_includes_profile(monkeypatch, tmp_path):
    monkeypatch.setattr(scanner, "SCANS_DIR", tmp_path)
    for profile in ScanProfile:
        path = scanner.generate_ndjson_path(profile)
        assert path.name.endswith(f"_{profile.value}.ndjson")


# ── parse_ndjson_output ──────────────────────────────────────────────────────


def test_parse_empty_output():
    assert scanner.parse_ndjson_output("") == ([], [])
    assert scanner.parse_ndjson_output("   \n\n  ") == ([], [])


def test_parse_package_line():
    line = json.dumps({"record_type": "package", "package_name": "requests", "ecosystem": "pypi"})
    packages, findings = scanner.parse_ndjson_output(line)
    assert packages == [{"record_type": "package", "package_name": "requests", "ecosystem": "pypi"}]
    assert findings == []


def test_parse_finding_line():
    line = json.dumps({"record_type": "finding", "package_name": "lodash", "severity": "high"})
    packages, findings = scanner.parse_ndjson_output(line)
    assert packages == []
    assert findings == [{"record_type": "finding", "package_name": "lodash", "severity": "high"}]


def test_parse_mixed_and_malformed():
    output = "\n".join(
        [
            '{"record_type": "package", "package_name": "a"}',
            "this is not json",
            '{"record_type": "finding", "package_name": "b"}',
            '{"record_type": "metadata", "whatever": true}',
            "",
        ]
    )
    packages, findings = scanner.parse_ndjson_output(output)
    assert [p["package_name"] for p in packages] == ["a"]
    assert [f["package_name"] for f in findings] == ["b"]


def test_parse_line_without_record_type_is_skipped():
    packages, findings = scanner.parse_ndjson_output('{"package_name": "x"}')
    assert packages == []
    assert findings == []


def test_parse_preserves_order():
    output = "\n".join(
        [
            '{"record_type": "package", "package_name": "p1"}',
            '{"record_type": "finding", "package_name": "f1"}',
            '{"record_type": "package", "package_name": "p2"}',
        ]
    )
    packages, findings = scanner.parse_ndjson_output(output)
    assert [p["package_name"] for p in packages] == ["p1", "p2"]
    assert [f["package_name"] for f in findings] == ["f1"]


# ── calculate_summary ────────────────────────────────────────────────────────


def test_calculate_summary_empty():
    summary = scanner.calculate_summary([], [])
    assert summary.total_packages == 0
    assert summary.ecosystems_found == 0
    assert summary.findings_count == 0
    assert summary.ecosystem_counts == {}


def test_calculate_summary_counts():
    packages = [{"ecosystem": "npm"}, {"ecosystem": "npm"}, {"ecosystem": "pypi"}]
    findings = [{"severity": "high"}, {"severity": "low"}]
    summary = scanner.calculate_summary(packages, findings)
    assert summary.total_packages == 3
    assert summary.ecosystems_found == 2
    assert summary.findings_count == 2
    assert summary.ecosystem_counts == {"npm": 2, "pypi": 1}


def test_calculate_summary_unknown_ecosystem():
    summary = scanner.calculate_summary([{"package_name": "x"}], [])
    assert summary.ecosystem_counts == {"unknown": 1}


# ── get_scan_packages / get_scan_findings (NDJSON → record mapping) ─────────


def _write_ndjson(path, lines):
    path.write_text("\n".join(lines) + "\n")


def test_get_scan_packages_maps_fields(tmp_path):
    ndjson = tmp_path / "scan.ndjson"
    _write_ndjson(
        ndjson,
        [
            json.dumps(
                {
                    "record_type": "package",
                    "package_name": "requests",
                    "ecosystem": "pypi",
                    "version": "2.31.0",
                    "source_type": "lockfile",
                    "source_file": "req.txt",
                    "project_path": "/app",
                    "package_manager": "pip",
                    "confidence": "0.99",
                    "has_lifecycle_scripts": False,
                }
            ),
            '{"record_type": "finding", "package_name": "other"}',
        ],
    )
    packages = asyncio.run(scanner.get_scan_packages(1, str(ndjson)))
    assert len(packages) == 1
    pkg = packages[0]
    assert pkg.package_name == "requests"
    assert pkg.ecosystem == "pypi"
    assert pkg.version == "2.31.0"
    assert pkg.source_type == "lockfile"
    assert pkg.source_file == "req.txt"
    assert pkg.project_path == "/app"
    assert pkg.package_manager == "pip"
    assert pkg.confidence == "0.99"
    assert pkg.has_lifecycle_scripts is False


def test_get_scan_packages_missing_file(tmp_path):
    assert asyncio.run(scanner.get_scan_packages(1, str(tmp_path / "nope.ndjson"))) == []


def test_get_scan_findings_maps_fields(tmp_path):
    ndjson = tmp_path / "findings.ndjson"
    _write_ndjson(
        ndjson,
        [
            json.dumps(
                {
                    "record_type": "finding",
                    "package_name": "lodash",
                    "version": "4.17.21",
                    "ecosystem": "npm",
                    "severity": "high",
                    "catalog_id": "GHSA-xxx",
                    "catalog_name": "Prototype Pollution",
                    "evidence": "evidence text",
                    "source_file": "package-lock.json",
                    "source_type": "lockfile",
                    "root_kind": "npm",
                    "project_path": "/app",
                    "confidence": "0.95",
                }
            )
        ],
    )
    findings = asyncio.run(scanner.get_scan_findings(1, str(ndjson)))
    assert len(findings) == 1
    f = findings[0]
    assert f.package_name == "lodash"
    assert f.version == "4.17.21"
    assert f.ecosystem == "npm"
    assert f.severity == "high"
    assert f.catalog_id == "GHSA-xxx"
    assert f.catalog_name == "Prototype Pollution"
    assert f.evidence == "evidence text"
    assert f.root_kind == "npm"
    assert f.project_path == "/app"


def test_get_scan_findings_defaults(tmp_path):
    ndjson = tmp_path / "minimal.ndjson"
    _write_ndjson(ndjson, ['{"record_type": "finding"}'])
    findings = asyncio.run(scanner.get_scan_findings(1, str(ndjson)))
    assert len(findings) == 1
    assert findings[0].package_name == "unknown"
    assert findings[0].severity == "info"
