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

# Per-scan event queues for Server-Sent Events: each running scan pushes
# progress/terminal events here; the SSE endpoint drains the queue live.
_scan_queues: dict[int, asyncio.Queue] = {}


def _cleanup_scan(scan_id: int) -> None:
    """Drop the task and queue registries when a scan task finishes."""
    _background_tasks.pop(scan_id, None)
    _scan_queues.pop(scan_id, None)


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
    scan_id: int, request: ScanRequest, ndjson_path: Path, queue: asyncio.Queue
) -> None:
    """Execute a scan and update its record; runs detached from any request.

    Progress is forwarded to the scan's SSE queue (throttled by ``run_scan``),
    and a terminal event is pushed so subscribers close cleanly.
    """

    def on_progress(count: int) -> None:
        queue.put_nowait({"type": "progress", "packages_found": count})

    try:
        summary, _ = await run_scan(request, ndjson_path, on_progress=on_progress)
        await update_scan_status(
            scan_id=scan_id,
            status=ScanStatus.completed,
            summary=summary,
            ndjson_path=str(ndjson_path),
        )
        queue.put_nowait(
            {"type": "completed", "summary": summary.model_dump(mode="json")}
        )
    except Exception:
        logger.exception("Scan %s failed", scan_id)
        await update_scan_status(scan_id=scan_id, status=ScanStatus.failed)
        queue.put_nowait({"type": "failed"})


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

    queue: asyncio.Queue = asyncio.Queue()
    _scan_queues[scan_id] = queue
    task = asyncio.create_task(
        _run_scan_background(scan_id, request, ndjson_path, queue)
    )
    _background_tasks[scan_id] = task
    task.add_done_callback(lambda _t, sid=scan_id: _cleanup_scan(sid))

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


def _sse_event(payload: dict) -> str:
    """Format a dict as a Server-Sent Event with a named event type."""
    event_type = payload.get("type", "message")
    return f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"


@app.get("/api/scans/{scan_id}/events")
async def scan_events(scan_id: int):
    """Stream scan progress as Server-Sent Events until a terminal state.

    Late joiners get a snapshot first; live subscribers receive throttled
    progress events and a terminal event (completed/failed/cancelled) that
    closes the stream.
    """
    scan = await get_scan_detail(scan_id)  # 404s for unknown scans
    queue = _scan_queues.get(scan_id)

    async def event_stream():
        snapshot = {
            "type": "snapshot",
            "status": scan.status.value,
            "packages_found": scan.packages_found,
        }
        # Already finished: replay snapshot + terminal event and close.
        if scan.status in (ScanStatus.completed, ScanStatus.failed):
            yield _sse_event(snapshot)
            yield _sse_event({"type": scan.status.value})
            return

        yield _sse_event(snapshot)

        if queue is None:  # unreachable for a running scan; defensive only
            yield _sse_event({"type": "failed", "error": "event stream unavailable"})
            return

        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15)
            except asyncio.TimeoutError:
                yield ": ping\n\n"
                # Safety net: the scan may have reached a terminal state without
                # a queued event (e.g. deleted by another client).
                current = await get_scan(scan_id)
                if current is None:
                    yield _sse_event({"type": "cancelled"})
                    return
                if current.status in (ScanStatus.completed, ScanStatus.failed):
                    yield _sse_event({"type": current.status.value})
                    return
                continue
            yield _sse_event(event)
            if event.get("type") in ("completed", "failed", "cancelled"):
                return

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
    queue = _scan_queues.get(scan_id)
    if task and not task.done():
        task.cancel()
        try:
            await asyncio.wait_for(task, timeout=10)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            pass

    # Notify any SSE subscribers that the scan is gone (record removed below).
    if queue:
        queue.put_nowait({"type": "cancelled"})

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
