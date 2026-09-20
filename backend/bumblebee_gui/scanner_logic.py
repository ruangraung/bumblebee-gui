"""Pure helper logic behind the scan orchestration in scanner.py.

Command construction, NDJSON decoding, summary arithmetic and the NDJSON to
record mapping live here so they can be read, reasoned about and tested without
a subprocess, a web layer or a database in the picture.
"""

import json
from pathlib import Path
from typing import Iterable, Iterator, List, Optional

from .models import FindingRecord, PackageRecord, ScanSummary

PACKAGE = "package"
FINDING = "finding"
UNKNOWN = "unknown"
INFO = "info"


def record_type(record: dict) -> str:
    """Record type tag of an NDJSON record, empty string when it has none."""
    return record.get("record_type", "")


def decode_records(lines: Iterable[str]) -> Iterator[dict]:
    """Decode NDJSON lines, skipping blank lines and malformed JSON."""
    for line in lines:
        text = line.strip()
        if not text:
            continue
        try:
            yield json.loads(text)
        except json.JSONDecodeError:
            continue


def decode_ndjson(text: str) -> Iterator[dict]:
    """Decode a whole NDJSON document."""
    return decode_records(text.split("\n"))


def decode_line(line: bytes) -> Optional[dict]:
    """Decode one raw output line, None when it is not valid JSON."""
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        return None


def records_by_type(records: Iterable[dict], kind: str) -> List[dict]:
    """Records carrying the given type tag, input order preserved."""
    return [record for record in records if record_type(record) == kind]


def read_records(path: Path, kind: str) -> List[dict]:
    """Type-filtered records from an NDJSON file, empty list when it is absent."""
    if not path.exists():
        return []
    return records_by_type(decode_ndjson(path.read_text()), kind)


def parse_ndjson_output(output: str) -> tuple[List[dict], List[dict]]:
    """Parse NDJSON output into packages and findings."""
    records = list(decode_ndjson(output))
    return records_by_type(records, PACKAGE), records_by_type(records, FINDING)


def calculate_summary(packages: List[dict], findings: List[dict]) -> ScanSummary:
    """Calculate scan summary from parsed data."""
    ecosystem_counts = {}
    for pkg in packages:
        eco = pkg.get("ecosystem", UNKNOWN)
        ecosystem_counts[eco] = ecosystem_counts.get(eco, 0) + 1

    return ScanSummary(
        total_packages=len(packages),
        ecosystems_found=len(ecosystem_counts),
        findings_count=len(findings),
        ecosystem_counts=ecosystem_counts,
    )


def package_record(record: dict) -> PackageRecord:
    """Map an NDJSON package record onto its API model."""
    return PackageRecord(
        package_name=record.get("package_name", UNKNOWN),
        ecosystem=record.get("ecosystem", UNKNOWN),
        version=record.get("version", UNKNOWN),
        source_type=record.get("source_type"),
        source_file=record.get("source_file"),
        project_path=record.get("project_path"),
        package_manager=record.get("package_manager"),
        confidence=record.get("confidence"),
        has_lifecycle_scripts=record.get("has_lifecycle_scripts"),
    )


def finding_record(record: dict) -> FindingRecord:
    """Map an NDJSON finding record onto its API model."""
    return FindingRecord(
        package_name=record.get("package_name", UNKNOWN),
        version=record.get("version", UNKNOWN),
        ecosystem=record.get("ecosystem", UNKNOWN),
        severity=record.get("severity", INFO),
        catalog_id=record.get("catalog_id", ""),
        catalog_name=record.get("catalog_name", ""),
        evidence=record.get("evidence", ""),
        source_file=record.get("source_file"),
        source_type=record.get("source_type"),
        root_kind=record.get("root_kind"),
        project_path=record.get("project_path"),
        confidence=record.get("confidence"),
    )
