import asyncio
import json
import os
from datetime import datetime
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
    timestamp = datetime.utcnow().strftime("%Y-%m-%d_%H%M%S")
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
            if record.get("type") == "finding":
                findings.append(record)
            else:
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


async def run_scan(request: ScanRequest) -> tuple[ScanSummary, Path]:
    """Execute a Bumblebee scan and return results."""
    ensure_dirs()

    cmd = build_command(request)
    ndjson_path = generate_ndjson_path(request.profile)

    # Run Bumblebee as subprocess
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        error_msg = stderr.decode().strip()
        raise RuntimeError(f"Bumblebee scan failed: {error_msg}")

    # Save raw output
    ndjson_path.write_bytes(stdout)

    # Parse and summarize
    packages, findings = parse_ndjson_output(stdout.decode())
    summary = calculate_summary(packages, findings)

    return summary, ndjson_path


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
            if record.get("type") != "finding":
                packages.append(
                    PackageRecord(
                        name=record.get("name", "unknown"),
                        ecosystem=record.get("ecosystem", "unknown"),
                        version=record.get("version", "unknown"),
                        source=record.get("source", "unknown"),
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
            if record.get("type") == "finding":
                findings.append(
                    FindingRecord(
                        package=record.get("package", "unknown"),
                        version=record.get("version", "unknown"),
                        ecosystem=record.get("ecosystem", "unknown"),
                        severity=record.get("severity", "info"),
                        cve=record.get("cve"),
                        description=record.get("description", ""),
                        found_in=record.get("found_in", "unknown"),
                    )
                )
        except json.JSONDecodeError:
            continue

    return findings
