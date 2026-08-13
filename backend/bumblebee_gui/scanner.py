import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from .models import (
    ScanRequest,
    ScanSummary,
    PackageRecord,
    FindingRecord,
    ScanProfile,
)

BINARY_PATH = os.environ.get("BUMBLEBEE_BINARY", "/usr/local/bin/bumblebee")
DATA_DIR = Path(os.environ.get("BUMBLEBEE_DATA_DIR", Path.home() / ".bumblebee-gui"))
SCANS_DIR = DATA_DIR / "scans"


def ensure_dirs():
    """Ensure scan directory exists."""
    SCANS_DIR.mkdir(parents=True, exist_ok=True)


def build_command(request: ScanRequest) -> List[str]:
    """Build Bumblebee CLI command from scan request."""
    cmd = [BINARY_PATH, "scan", "--profile", request.profile.value]

    if request.ecosystems:
        for eco in request.ecosystems:
            cmd.extend(["--ecosystem", eco])

    if request.roots:
        for root in request.roots:
            cmd.extend(["--root", root])

    if request.exposure_catalog:
        cmd.extend(["--exposure-catalog", request.exposure_catalog])

    if request.findings_only:
        cmd.append("--findings-only")

    if request.max_duration:
        cmd.extend(["--max-duration", request.max_duration])

    return cmd


def generate_ndjson_path(profile: ScanProfile) -> Path:
    """Generate a unique NDJSON file path for a scan."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
    return SCANS_DIR / f"{timestamp}_{profile.value}.ndjson"


def parse_ndjson_output(output: str) -> tuple[List[dict], List[dict]]:
    """Parse NDJSON output into packages and findings."""
    packages = []
    findings = []

    for line in output.strip().split("\n"):
        if not line:
            continue
        try:
            record = json.loads(line)
            record_type = record.get("record_type", "")
            if record_type == "finding":
                findings.append(record)
            elif record_type == "package":
                packages.append(record)
        except json.JSONDecodeError:
            continue

    return packages, findings


def calculate_summary(packages: List[dict], findings: List[dict]) -> ScanSummary:
    """Calculate scan summary from parsed data."""
    ecosystem_counts = {}
    for pkg in packages:
        eco = pkg.get("ecosystem", "unknown")
        ecosystem_counts[eco] = ecosystem_counts.get(eco, 0) + 1

    return ScanSummary(
        total_packages=len(packages),
        ecosystems_found=len(ecosystem_counts),
        findings_count=len(findings),
        ecosystem_counts=ecosystem_counts,
    )


async def run_scan(
    request: ScanRequest, ndjson_path: Optional[Path] = None
) -> tuple[ScanSummary, Path]:
    """Execute a Bumblebee scan, streaming NDJSON output to disk as it arrives.

    Unlike a buffered ``communicate()``-style run, each line is written to the
    output file the moment the CLI produces it. That makes live progress
    observable (see ``count_packages``) and keeps partial output when a scan
    fails or is cancelled. On cancellation the CLI subprocess is killed so a
    cancelled scan never keeps scanning in the background.
    """
    ensure_dirs()

    cmd = build_command(request)
    if ndjson_path is None:
        ndjson_path = generate_ndjson_path(request.profile)

    # Run Bumblebee as subprocess
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    if process.stdout is None or process.stderr is None:
        # Cannot happen with PIPE above — guards the type checker only.
        raise RuntimeError("Failed to capture subprocess output")

    # Drain stderr concurrently so a chatty CLI can't deadlock the stream.
    stderr_task = asyncio.create_task(process.stderr.read())

    try:
        with open(ndjson_path, "wb") as out:
            async for raw in process.stdout:
                out.write(raw)
        await process.wait()
        stderr = await stderr_task
    except asyncio.CancelledError:
        # Cancellation (user aborted the scan): kill the CLI, reap it, and
        # release the stderr reader before propagating.
        process.kill()
        await process.wait()
        if not stderr_task.done():
            stderr_task.cancel()
            try:
                await stderr_task
            except asyncio.CancelledError:
                pass
        raise

    if process.returncode != 0:
        error_msg = stderr.decode().strip()
        raise RuntimeError(f"Bumblebee scan failed: {error_msg}")

    # Parse and summarize from the streamed file (the on-disk source of truth).
    packages, findings = parse_ndjson_output(ndjson_path.read_text())
    summary = calculate_summary(packages, findings)

    return summary, ndjson_path


def count_packages(path: Path) -> int:
    """Count package records currently in an NDJSON file (live scan progress).

    Cheap enough to call on every poll: scans are a few MB at most.
    """
    if not path.exists():
        return 0
    count = 0
    with open(path, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                if json.loads(line).get("record_type") == "package":
                    count += 1
            except json.JSONDecodeError:
                continue
    return count


async def get_scan_packages(scan_id: int, ndjson_path: str) -> List[PackageRecord]:
    """Load packages from a scan's NDJSON file."""
    path = Path(ndjson_path)
    if not path.exists():
        return []

    packages = []
    for line in path.read_text().strip().split("\n"):
        if not line:
            continue
        try:
            record = json.loads(line)
            if record.get("record_type") == "package":
                packages.append(
                    PackageRecord(
                        package_name=record.get("package_name", "unknown"),
                        ecosystem=record.get("ecosystem", "unknown"),
                        version=record.get("version", "unknown"),
                        source_type=record.get("source_type"),
                        source_file=record.get("source_file"),
                        project_path=record.get("project_path"),
                        package_manager=record.get("package_manager"),
                        confidence=record.get("confidence"),
                        has_lifecycle_scripts=record.get("has_lifecycle_scripts"),
                    )
                )
        except json.JSONDecodeError:
            continue

    return packages


async def get_scan_findings(scan_id: int, ndjson_path: str) -> List[FindingRecord]:
    """Load findings from a scan's NDJSON file."""
    path = Path(ndjson_path)
    if not path.exists():
        return []

    findings = []
    for line in path.read_text().strip().split("\n"):
        if not line:
            continue
        try:
            record = json.loads(line)
            if record.get("record_type") == "finding":
                findings.append(
                    FindingRecord(
                        package_name=record.get("package_name", "unknown"),
                        version=record.get("version", "unknown"),
                        ecosystem=record.get("ecosystem", "unknown"),
                        severity=record.get("severity", "info"),
                        catalog_id=record.get("catalog_id", ""),
                        catalog_name=record.get("catalog_name", ""),
                        evidence=record.get("evidence", ""),
                        source_file=record.get("source_file"),
                        source_type=record.get("source_type"),
                        root_kind=record.get("root_kind"),
                        project_path=record.get("project_path"),
                        confidence=record.get("confidence"),
                    )
                )
        except json.JSONDecodeError:
            continue

    return findings
