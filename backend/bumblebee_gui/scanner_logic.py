"""Pure helper logic behind the scan orchestration in scanner.py.

Command construction, NDJSON decoding, summary arithmetic and the NDJSON to
record mapping live here so they can be read, reasoned about and tested without
a subprocess, a web layer or a database in the picture.
"""

import json
import time
from pathlib import Path
from typing import Callable, Iterable, Iterator, List, Optional

from .models import FindingRecord, PackageRecord, ScanSummary

PACKAGE = "package"
FINDING = "finding"
SUMMARY = "scan_summary"
UNKNOWN = "unknown"
INFO = "info"


def repeat_option(flag: str, values: Optional[Iterable[str]]) -> List[str]:
    """A CLI flag repeated once per value, empty when there are no values."""
    return [argument for value in values or () for argument in (flag, value)]


def valued_option(flag: str, value: Optional[str]) -> List[str]:
    """A CLI flag with a single value, omitted when the value is unset."""
    return [flag, value] if value else []


def toggle_option(flag: str, enabled: bool) -> List[str]:
    """A boolean CLI flag, present only when enabled."""
    return [flag] if enabled else []


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


def coverage_fields(text: str) -> dict:
    """Coverage facts from the CLI's scan_summary record, empty when absent.

    The CLI exits 0 on a scan it stopped at its own time limit, so this record
    is the only place the truncation appears.
    """
    summaries = records_by_type(decode_ndjson(text), SUMMARY)
    if not summaries:
        return {}
    last = summaries[-1]
    return {
        "timed_out": bool(last.get("timed_out")),
        "duration_ms": last.get("duration_ms"),
        "files_considered": last.get("files_considered"),
    }


def calculate_summary(
    packages: List[dict], findings: List[dict], coverage: Optional[dict] = None
) -> ScanSummary:
    """Calculate scan summary from parsed records and the coverage facts."""
    ecosystem_counts = {}
    for pkg in packages:
        eco = pkg.get("ecosystem", UNKNOWN)
        ecosystem_counts[eco] = ecosystem_counts.get(eco, 0) + 1

    return ScanSummary(
        total_packages=len(packages),
        ecosystems_found=len(ecosystem_counts),
        findings_count=len(findings),
        ecosystem_counts=ecosystem_counts,
        **(coverage or {}),
    )


# Long enough for the scanner's sentence, short enough to sit in a cell of the
# interface and a column of the database.
ERROR_LIMIT = 300


def cli_error_message(text: str) -> str:
    """The one line worth keeping from the scanner's error output.

    A value the scanner refuses prints its complaint and then the whole usage
    block, which runs to thousands of characters. The complaint is the reason a
    scan failed; the usage block is noise everywhere the reason is read. An
    empty result means the output carried no complaint, only usage text.
    """
    for line in text.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("Usage of"):
            return stripped[:ERROR_LIMIT]
    return ""


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


def is_package_line(line: bytes) -> bool:
    """Cheap pre-filter: only a line mentioning packages can hold a package record."""
    return bool(line) and b"package" in line


PROGRESS_STEP = 25
PROGRESS_INTERVAL = 0.5


class PackageProgress:
    """Running package count for a live scan, reported at a throttled rate.

    ``observe`` is fed every raw output line; the callback fires at most once
    per ``PROGRESS_STEP`` packages or ``PROGRESS_INTERVAL`` seconds, whichever
    comes first, so a fast CLI cannot flood the caller with updates.
    """

    def __init__(self, on_progress: Optional[Callable[[int], None]] = None) -> None:
        self._on_progress = on_progress
        self._seen = 0
        self._last_emit = 0.0

    def observe(self, line: bytes) -> None:
        """Count one raw output line and report progress when it is due."""
        if self._on_progress is None or not is_package_line(line):
            return
        record = decode_line(line)
        if record is None or record_type(record) != PACKAGE:
            return
        self._seen += 1
        if self._is_due():
            self._on_progress(self._seen)

    def _is_due(self) -> bool:
        """Whether the count is reported now, updating the emit clock when it is."""
        now = time.monotonic()
        if self._seen % PROGRESS_STEP != 0 and now - self._last_emit < PROGRESS_INTERVAL:
            return False
        self._last_emit = now
        return True


CLI_NAME = "bumblebee"
SHORT_COMMIT = 7


def parse_cli_version(text: str) -> tuple[Optional[str], Optional[str]]:
    """The version and commit from a ``bumblebee version`` run.

    The CLI prints a header line naming itself, then ``key: value`` lines. A
    shape this build does not recognise yields None rather than a guess, and the
    About panel then reports that the version could not be read.
    """
    version = None
    commit = None
    for line in text.splitlines():
        stripped = line.strip()
        if version is None and stripped.startswith(f"{CLI_NAME} "):
            version = stripped.split(None, 1)[1].strip() or None
        elif stripped.startswith("commit:"):
            commit = stripped.split(":", 1)[1].strip()[:SHORT_COMMIT] or None
    return version, commit
