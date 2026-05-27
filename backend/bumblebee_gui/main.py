import csv
import io
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .database import (
    delete_scan,
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
from .scanner import get_scan_findings, get_scan_packages, run_scan


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize DB on startup."""
    await init_db()
    yield


app = FastAPI(
    title="Bumblebee GUI",
    description="Web interface for Bumblebee supply chain scanner",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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


@app.post("/api/scans", response_model=ScanRecord, status_code=201)
async def create_scan(request: ScanRequest):
    """Trigger a new scan."""
    # Create scan record with "running" status
    scan_id = await insert_scan(
        profile=request.profile,
        status=ScanStatus.running,
    )

    try:
        # Run the actual scan
        summary, ndjson_path = await run_scan(request)

        # Update with results
        await update_scan_status(
            scan_id=scan_id,
            status=ScanStatus.completed,
            summary=summary,
            ndjson_path=str(ndjson_path),
        )

        # Fetch and return the completed record
        scan = await get_scan(scan_id)
        if not scan:
            raise HTTPException(status_code=500, detail="Failed to retrieve scan after completion")

        # Attach ndjson_path (not stored in DB via update_scan_status)
        return scan

    except RuntimeError as e:
        # Scan failed — mark as failed and return the record
        await update_scan_status(scan_id=scan_id, status=ScanStatus.failed)
        scan = await get_scan(scan_id)
        if scan:
            return scan
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        await update_scan_status(scan_id=scan_id, status=ScanStatus.failed)
        raise HTTPException(status_code=500, detail=f"Scan failed: {e}")


@app.get("/api/scans", response_model=list[ScanRecord])
async def list_scans(limit: int = Query(default=20, ge=1, le=100)):
    """List recent scans."""
    return await get_scans(limit=limit)


@app.get("/api/scans/{scan_id}", response_model=ScanRecord)
async def get_scan_detail(scan_id: int):
    """Get scan details by ID."""
    scan = await get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail=f"Scan {scan_id} not found")
    return scan


@app.delete("/api/scans/{scan_id}")
async def delete_scan_record(scan_id: int):
    """Delete a scan by ID."""
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
