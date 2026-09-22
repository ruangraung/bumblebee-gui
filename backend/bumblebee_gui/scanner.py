import asyncio
import os
from dataclasses import dataclass
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
    PackageProgress,
    calculate_summary,
    cli_error_message,
    coverage_fields,
    decode_records,
    package_record,
    finding_record,
    parse_ndjson_output,
    read_records,
    record_type,
    repeat_option,
    toggle_option,
    valued_option,
)

BINARY_PATH = os.environ.get("BUMBLEBEE_BINARY", "/usr/local/bin/bumblebee")
DATA_DIR = Path(os.environ.get("BUMBLEBEE_DATA_DIR", Path.home() / ".bumblebee-gui"))
SCANS_DIR = DATA_DIR / "scans"
THREAT_INTEL_DIR = Path(os.environ.get("BUMBLEBEE_THREAT_INTEL_DIR", "/opt/bumblebee/threat-intel"))


def ensure_dirs():
    """Ensure scan directory exists."""
    SCANS_DIR.mkdir(parents=True, exist_ok=True)


def exposure_catalog(request: ScanRequest) -> Optional[str]:
    """Resolve which catalogue the scan compares packages against.

    An explicit path wins. An empty string means the caller wants no catalogue
    at all, which is the only way to ask for a scan that reports nothing. When
    the request says nothing, the catalogues bundled with the scanner are used,
    if this install has them; a bare checkout does not, and scans then behave
    exactly as they did before catalogues were bundled.
    """
    if request.exposure_catalog is not None:
        return request.exposure_catalog or None
    return str(THREAT_INTEL_DIR) if THREAT_INTEL_DIR.is_dir() else None


def build_command(request: ScanRequest) -> List[str]:
    """Build Bumblebee CLI command from scan request."""
    cmd = [BINARY_PATH, "scan", "--profile", request.profile.value]
    cmd += repeat_option("--ecosystem", request.ecosystems)
    cmd += repeat_option("--root", request.roots)
    cmd += valued_option("--exposure-catalog", exposure_catalog(request))
    cmd += toggle_option("--findings-only", request.findings_only)
    cmd += valued_option("--max-duration", request.max_duration)
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


@dataclass
class _CliProcess:
    """A running Bumblebee CLI together with its captured output streams."""

    process: asyncio.subprocess.Process
    stdout: asyncio.StreamReader
    stderr: asyncio.StreamReader


async def _spawn_cli(cmd: List[str]) -> _CliProcess:
    """Start the Bumblebee CLI with its output streams captured."""
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    if process.stdout is None or process.stderr is None:
        # Cannot happen with PIPE above; guards the type checker only.
        raise RuntimeError("Failed to capture subprocess output")
    return _CliProcess(process, process.stdout, process.stderr)


async def _stream_to_file(stream, ndjson_path: Path, on_progress) -> None:
    """Write every NDJSON line to disk as it arrives, reporting progress."""
    progress = PackageProgress(on_progress)
    with open(ndjson_path, "wb") as out:
        async for line in _iter_lines(stream):
            out.write(line + b"\n")
            progress.observe(line)


async def _abort(process, stderr_task) -> None:
    """Kill a cancelled scan's CLI, reap it and release its stderr reader."""
    process.kill()
    await process.wait()
    if stderr_task.done():
        return
    stderr_task.cancel()
    try:
        await stderr_task
    except asyncio.CancelledError:
        pass


async def _run_cli(cli: _CliProcess, ndjson_path: Path, on_progress) -> bytes:
    """Stream the CLI output to disk, then wait for it and return its stderr.

    The stderr reader is drained concurrently so a chatty CLI cannot deadlock
    the stream.
    """
    stderr_task = asyncio.create_task(cli.stderr.read())
    try:
        await _stream_to_file(cli.stdout, ndjson_path, on_progress)
        await cli.process.wait()
        return await stderr_task
    except asyncio.CancelledError:
        # Cancellation (user aborted the scan): kill the CLI, reap it, and
        # release the stderr reader before propagating.
        await _abort(cli.process, stderr_task)
        raise


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
    cli = await _spawn_cli(cmd)
    stderr = await _run_cli(cli, ndjson_path, on_progress)

    if cli.process.returncode != 0:
        reason = cli_error_message(stderr.decode())
        raise RuntimeError(
            reason or f"The scanner exited with status {cli.process.returncode}."
        )

    # Parse and summarize from the streamed file (the on-disk source of truth).
    # The CLI exits 0 even when it stopped at the time limit, so its own
    # coverage record is read from the same text.
    text = ndjson_path.read_text()
    packages, findings = parse_ndjson_output(text)
    summary = calculate_summary(packages, findings, coverage_fields(text))

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
