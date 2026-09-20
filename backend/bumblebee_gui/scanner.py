import asyncio
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, List, Optional

from .models import (
    ScanRequest,
    ScanSummary,
    PackageRecord,
    FindingRecord,
    ScanProfile,
)
from .scanner_logic import (
    FINDING,
    PACKAGE,
    calculate_summary,
    decode_records,
    package_record,
    finding_record,
    parse_ndjson_output,
    read_records,
    record_type,
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


async def _iter_lines(stream):
    """Yield complete lines from an async byte stream, buffering partials."""
    buf = b""
    async for chunk in stream:
        buf += chunk
        *lines, buf = buf.split(b"\n")
        for line in lines:
            yield line.rstrip(b"\r")
    if buf:
        yield buf.rstrip(b"\r")


async def run_scan(
    request: ScanRequest,
    ndjson_path: Optional[Path] = None,
    on_progress: Optional[Callable[[int], None]] = None,
) -> tuple[ScanSummary, Path]:
    """Execute a Bumblebee scan, streaming NDJSON output to disk as it arrives.

    Unlike a buffered ``communicate()``-style run, each line is written to the
    output file the moment the CLI produces it. That makes live progress
    observable (see ``count_packages``) and keeps partial output when a scan
    fails or is cancelled. On cancellation the CLI subprocess is killed so a
    cancelled scan never keeps scanning in the background.

    ``on_progress``, when given, is called with the running package count as
    packages stream in — throttled to every 25 packages or 0.5s, whichever comes
    first — so callers can push live updates without re-reading the file.
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
        packages_seen = 0
        last_emit = 0.0
        with open(ndjson_path, "wb") as out:
            async for line in _iter_lines(process.stdout):
                out.write(line + b"\n")
                if on_progress is not None and line and b"package" in line:
                    try:
                        if json.loads(line).get("record_type") == "package":
                            packages_seen += 1
                            now = time.monotonic()
                            if packages_seen % 25 == 0 or now - last_emit >= 0.5:
                                last_emit = now
                                on_progress(packages_seen)
                    except json.JSONDecodeError:
                        continue
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
    with open(path, encoding="utf-8") as f:
        return sum(1 for record in decode_records(f) if record_type(record) == PACKAGE)


async def get_scan_packages(scan_id: int, ndjson_path: str) -> List[PackageRecord]:
    """Load packages from a scan's NDJSON file."""
    return [package_record(record) for record in read_records(Path(ndjson_path), PACKAGE)]


async def get_scan_findings(scan_id: int, ndjson_path: str) -> List[FindingRecord]:
    """Load findings from a scan's NDJSON file."""
    return [finding_record(record) for record in read_records(Path(ndjson_path), FINDING)]
