import asyncio
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .api_helpers import (
    attach_packages_found,
    remove_scan_file,
    require_scan,
    require_scan_data,
)
from .catalogue import catalogue_summary
from .database import (
    delete_scan,
    fail_stale_running_scans,
    get_scan,
    get_scans,
    init_db,
    insert_scan,
    update_scan_status,
)
from .exporters import EXPORT_FORMATS, ExportPayload, build_export_response
from .models import (
    CatalogueSummary,
    FindingRecord,
    HostMountReport,
    PackageRecord,
    ScanRecord,
    ScanRequest,
    ScanStatus,
)
from .roots import HOST_MOUNT, host_mount_report, inside_mount, root_problems
from .scanner import (
    THREAT_INTEL_DIR,
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


async def _cancel_running_scan(scan_id: int) -> None:
    """Cancel a scan's detached task and wake any SSE subscriber.

    Both registry entries are read up front: the task's done callback drops
    them, so looking them up after the cancel could miss the subscriber queue.
    The task kills the CLI subprocess (see scanner.run_scan) before finishing,
    so no zombie scan keeps running after the record is gone.
    """
    task = _background_tasks.get(scan_id)
    queue = _scan_queues.get(scan_id)

    if task and not task.done():
        task.cancel()
        try:
            await asyncio.wait_for(task, timeout=10)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            pass

    # Notify any SSE subscribers that the scan is gone (record removed later).
    if queue:
        queue.put_nowait({"type": "cancelled"})


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


@app.get("/api/host-directories", response_model=HostMountReport)
async def host_directories(path: str = Query(default="")) -> HostMountReport:
    """Directories inside the host mount, for choosing a scan root.

    Confined to the mount: the scanner is a container, and this reports what it
    was given instead of browsing the filesystem it runs on. An unmounted host
    is reported rather than refused, because the scan form shows that state.
    """
    if path and not inside_mount(path, HOST_MOUNT):
        raise HTTPException(
            status_code=400, detail=f"{path} is outside the host mount {HOST_MOUNT}."
        )
    return HostMountReport(**host_mount_report(path, HOST_MOUNT))


@app.get("/api/exposure-catalog", response_model=CatalogueSummary)
async def exposure_catalogue() -> CatalogueSummary:
    """What the scanner compares packages against, counted from the catalogues
    it was given.

    A scan that matched nothing means one thing when a thousand package versions
    were compared, and something else entirely when none were.
    """
    return CatalogueSummary(**catalogue_summary(THREAT_INTEL_DIR))


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
    GET /api/scans/{scan_id} for status transitions to completed/failed.

    A root the scanner cannot read is refused here with 422, naming the
    directories it can read instead.
    """
    problems = root_problems(request.roots)
    if problems:
        raise HTTPException(status_code=422, detail="\n".join(problems))

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
    """List recent scans, with live progress for any that are running."""
    scans = await get_scans(limit=limit)
    return [attach_packages_found(scan) for scan in scans]


@app.get("/api/scans/{scan_id}", response_model=ScanRecord)
async def get_scan_detail(scan_id: int):
    """Get scan details by ID, with live progress while running."""
    return attach_packages_found(await require_scan(scan_id))


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
    scan = await require_scan(scan_id)
    await _cancel_running_scan(scan_id)

    # Clean up NDJSON file on disk (covers the partial file of a cancelled run)
    remove_scan_file(scan.ndjson_path)

    deleted = await delete_scan(scan_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Scan {scan_id} not found")
    return {"detail": f"Scan {scan_id} deleted"}


@app.get("/api/scans/{scan_id}/packages", response_model=list[PackageRecord])
async def get_packages(scan_id: int):
    """Get packages from a scan."""
    _, ndjson_path = await require_scan_data(scan_id)
    return await get_scan_packages(scan_id, ndjson_path)


@app.get("/api/scans/{scan_id}/findings", response_model=list[FindingRecord])
async def get_findings(scan_id: int):
    """Get findings from a scan."""
    _, ndjson_path = await require_scan_data(scan_id)
    return await get_scan_findings(scan_id, ndjson_path)


@app.get("/api/scans/{scan_id}/export")
async def export_scan(
    scan_id: int,
    format: str = Query(default="json", pattern="^(json|csv)$"),
):
    """Export scan data as JSON or CSV."""
    scan, ndjson_path = await require_scan_data(scan_id)
    packages = await get_scan_packages(scan_id, ndjson_path)
    findings = await get_scan_findings(scan_id, ndjson_path)
    payload = ExportPayload(scan=scan, packages=packages, findings=findings)
    return build_export_response(scan_id, payload, EXPORT_FORMATS[format])
