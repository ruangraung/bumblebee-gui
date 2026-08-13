import asyncio
import csv
import io
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .database import (
    delete_scan,
    fail_stale_running_scans,
    get_scan,
    get_scans,
    init_db,
    insert_scan,
    update_scan_status,
)
from .models import (
    FindingRecord,
    PackageRecord,
    ScanRecord,
    ScanRequest,
    ScanStatus,
)
from .scanner import (
    count_packages,
    generate_ndjson_path,
    get_scan_findings,
    get_scan_packages,
    run_scan,
)

logger = logging.getLogger("bumblebee_gui")

# Strong references to in-flight scan tasks keyed by scan id, so they are not
# garbage-collected mid-execution (asyncio keeps only weak references) and can
# be cancelled by id when a running scan is deleted.
_background_tasks: dict[int, asyncio.Task] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize DB on startup and recover stale rows."""
    await init_db()
    await fail_stale_running_scans()
    yield


app = FastAPI(
    title="Bumblebee GUI",
    description="Web interface for Bumblebee supply chain scanner",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — local Vite dev server only (localhost/127.0.0.1)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {"name": "Bumblebee GUI", "version": "0.1.0", "docs": "/docs"}


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "version": "0.1.0"}


async def _run_scan_background(
    scan_id: int, request: ScanRequest, ndjson_path: Path
) -> None:
    """Execute a scan and update its record; runs detached from any request."""
    try:
        summary, _ = await run_scan(request, ndjson_path)
        await update_scan_status(
            scan_id=scan_id,
            status=ScanStatus.completed,
            summary=summary,
            ndjson_path=str(ndjson_path),
        )
    except Exception:
        logger.exception("Scan %s failed", scan_id)
        await update_scan_status(scan_id=scan_id, status=ScanStatus.failed)


@app.post("/api/scans", response_model=ScanRecord, status_code=202)
async def create_scan(request: ScanRequest):
    """Submit a new scan. Runs in the background; poll
    GET /api/scans/{scan_id} for status transitions to completed/failed."""
    # The output path is decided up front so the record carries it from the
    # start — a cancelled scan can then clean up its partial file.
    ndjson_path = generate_ndjson_path(request.profile)
    scan_id = await insert_scan(
        profile=request.profile,
        status=ScanStatus.running,
        ndjson_path=str(ndjson_path),
    )

    # Read the record BEFORE spawning the background task so the 202 response
    # deterministically reports "running" — otherwise a fast scan could flip
    # to completed before the handler re-reads it (race in the contract).
    scan = await get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=500, detail="Failed to create scan record")

    task = asyncio.create_task(_run_scan_background(scan_id, request, ndjson_path))
    _background_tasks[scan_id] = task
    task.add_done_callback(lambda _t, sid=scan_id: _background_tasks.pop(sid, None))

    return scan


@app.get("/api/scans", response_model=list[ScanRecord])
async def list_scans(limit: int = Query(default=20, ge=1, le=100)):
    """List recent scans."""
    return await get_scans(limit=limit)


@app.get("/api/scans/{scan_id}", response_model=ScanRecord)
async def get_scan_detail(scan_id: int):
    """Get scan details by ID, with live progress while running."""
    scan = await get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail=f"Scan {scan_id} not found")

    # Live progress: packages discovered so far while running; the final total
    # once completed. Findings-only scans report 0 until done — findings are
    # only counted in the summary.
    packages_found = None
    if scan.status == ScanStatus.completed and scan.summary:
        packages_found = scan.summary.total_packages
    elif scan.status == ScanStatus.running and scan.ndjson_path:
        packages_found = count_packages(Path(scan.ndjson_path))

    if packages_found is not None:
        scan = scan.model_copy(update={"packages_found": packages_found})
    return scan


@app.delete("/api/scans/{scan_id}")
async def delete_scan_record(scan_id: int):
    """Delete a scan by ID. If it is still running, cancels it first."""
    # Fetch scan first to get ndjson_path for cleanup
    scan = await get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail=f"Scan {scan_id} not found")

    # If the scan is still running, cancel its background task. The task kills
    # the CLI subprocess (see scanner.run_scan) before finishing, so no zombie
    # scan keeps running after the record is gone.
    task = _background_tasks.get(scan_id)
    if task and not task.done():
        task.cancel()
        try:
            await asyncio.wait_for(task, timeout=10)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            pass

    # Clean up NDJSON file on disk (covers the partial file of a cancelled run)
    if scan.ndjson_path:
        Path(scan.ndjson_path).unlink(missing_ok=True)
    deleted = await delete_scan(scan_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Scan {scan_id} not found")
    return {"detail": f"Scan {scan_id} deleted"}


@app.get("/api/scans/{scan_id}/packages", response_model=list[PackageRecord])
async def get_packages(scan_id: int):
    """Get packages from a scan."""
    scan = await get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail=f"Scan {scan_id} not found")
    if not scan.ndjson_path:
        raise HTTPException(status_code=404, detail="No data file for this scan")
    return await get_scan_packages(scan_id, scan.ndjson_path)


@app.get("/api/scans/{scan_id}/findings", response_model=list[FindingRecord])
async def get_findings(scan_id: int):
    """Get findings from a scan."""
    scan = await get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail=f"Scan {scan_id} not found")
    if not scan.ndjson_path:
        raise HTTPException(status_code=404, detail="No data file for this scan")
    return await get_scan_findings(scan_id, scan.ndjson_path)


@app.get("/api/scans/{scan_id}/export")
async def export_scan(
    scan_id: int,
    format: str = Query(default="json", pattern="^(json|csv)$"),
):
    """Export scan data as JSON or CSV."""
    scan = await get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail=f"Scan {scan_id} not found")
    if not scan.ndjson_path:
        raise HTTPException(status_code=404, detail="No data file for this scan")

    packages = await get_scan_packages(scan_id, scan.ndjson_path)
    findings = await get_scan_findings(scan_id, scan.ndjson_path)

    if format == "json":
        data = {
            "scan": scan.model_dump(mode="json"),
            "packages": [p.model_dump() for p in packages],
            "findings": [f.model_dump() for f in findings],
        }
        content = json.dumps(data, indent=2)
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=scan_{scan_id}.json"},
        )

    # CSV export
    output = io.StringIO()

    # Packages section
    output.write("=== PACKAGES ===\n")
    if packages:
        pkg_writer = csv.DictWriter(output, fieldnames=packages[0].model_dump().keys())
        pkg_writer.writeheader()
        for p in packages:
            pkg_writer.writerow(p.model_dump())

    # Findings section
    output.write("\n=== FINDINGS ===\n")
    if findings:
        fnd_writer = csv.DictWriter(output, fieldnames=findings[0].model_dump().keys())
        fnd_writer.writeheader()
        for f in findings:
            fnd_writer.writerow(f.model_dump())

    content = output.getvalue()
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=scan_{scan_id}.csv"},
    )
