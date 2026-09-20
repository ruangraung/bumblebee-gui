"""Shared lookups and record shaping for the API routes.

Routes stay at the level of validate, call logic, return the record. Raising
the right HTTP error for a missing scan, decorating a record with live progress
and clearing a scan's file all live here so the read endpoints cannot drift
apart from one another.
"""

from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from .database import get_scan
from .models import ScanRecord, ScanStatus
from .scanner import count_packages


async def require_scan(scan_id: int) -> ScanRecord:
    """Load a scan, or raise the 404 the API contract specifies."""
    scan = await get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail=f"Scan {scan_id} not found")
    return scan


async def require_scan_data(scan_id: int) -> tuple[ScanRecord, str]:
    """Load a scan that has an NDJSON file to read; 404s otherwise.

    Returns the record together with its data path, so routes never have to
    handle a missing path themselves.
    """
    scan = await require_scan(scan_id)
    if not scan.ndjson_path:
        raise HTTPException(status_code=404, detail="No data file for this scan")
    return scan, scan.ndjson_path


def attach_packages_found(scan: ScanRecord) -> ScanRecord:
    """Compute the live `packages_found` field for a scan record.

    Running scans report packages discovered so far (counted from the partial
    NDJSON file); completed scans report the final total from their summary.
    Findings-only scans report 0 until done; findings are only counted in
    the summary. Shared by the detail and list endpoints so the dashboard
    can render concurrent-scan progress from one cheap list call.
    """
    packages_found = None
    if scan.status == ScanStatus.completed and scan.summary:
        packages_found = scan.summary.total_packages
    elif scan.status == ScanStatus.running and scan.ndjson_path:
        packages_found = count_packages(Path(scan.ndjson_path))

    if packages_found is not None:
        return scan.model_copy(update={"packages_found": packages_found})
    return scan


def remove_scan_file(ndjson_path: Optional[str]) -> None:
    """Delete a scan's NDJSON file (covers the partial file of a cancelled run)."""
    if ndjson_path:
        Path(ndjson_path).unlink(missing_ok=True)
