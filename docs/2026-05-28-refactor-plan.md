# Bumblebee GUI — Refactor Plan

**Date:** 2026-05-28  
**Author:** Nadya (Hermes Agent)  
**Status:** Draft — ready for PI + Molly to execute  
**Context:** Tested on Mac (Apple Silicon), initial build works but has bugs and UX issues that need a full refactor pass.

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Bug Fixes (P0)](#2-bug-fixes-p0)
3. [Architecture Improvements (P1)](#3-architecture-improvements-p1)
4. [Feature Enhancements (P2)](#4-feature-enhancements-p2)
5. [Polish & DX (P3)](#5-polish--dx-p3)
6. [File-by-File Change List](#6-file-by-file-change-list)
7. [Testing Checklist](#7-testing-checklist)
8. [Reference: Bumblebee NDJSON Format](#8-reference-bumblebee-ndjson-format)

---

## 1. Current State Assessment

### What Works

- Backend API starts and responds to health checks
- Frontend renders all 5 pages (Dashboard, Scan, Results, Findings, Settings)
- Scan triggers bumblebee subprocess and saves NDJSON output
- Package list displays with ecosystem filtering, search, and pagination
- Dark/light theme toggle works
- Export to JSON and CSV functions

### What's Broken or Wrong

| # | Severity | Component | Issue |
|---|----------|-----------|-------|
| 1 | **Critical** | `Scan.tsx` | Ecosystem list includes ecosystems bumblebee doesn't support (`cargo`, `maven`, `nuget`, `cocoapods`) and is missing ones it does (`packagist`, `mcp`, `editor-extension`, `browser-extension`) |
| 2 | **Critical** | `models.py` | `FindingRecord` has fields (`cve`, `description`, `found_in`) that don't exist in bumblebee's NDJSON output. Missing: `catalog_id`, `catalog_name`, `evidence`, `source_file`, `root_kind`, `project_path`, `confidence` |
| 3 | **Critical** | `scanner.py` | `get_scan_findings()` maps `found_in` but bumblebee outputs `source_file` |
| 4 | **High** | `main.py` | `POST /api/scans` blocks until scan completes. Deep scans can take 10+ minutes with no progress feedback |
| 5 | **High** | `Scan.tsx` | Exposure catalog is a raw text input — no file browser, no preset catalog picker from threat_intel |
| 6 | **Medium** | `scanner.py` | `get_scan_packages()` and `get_scan_findings()` read entire NDJSON file into memory. Slow for large scans (10K+ records) |
| 7 | **Medium** | `Scan.tsx` | `ALL_ECOSYSTEMS` is hardcoded — should be derived from bumblebee's actual supported ecosystems |
| 8 | **Medium** | `Scan.tsx` | `cargo` in the preset list is not a real bumblebee ecosystem |
| 9 | **Low** | `models.py` | `PackageRecord` is missing fields: `project_path`, `source_file`, `source_type`, `package_manager`, `confidence`, `has_lifecycle_scripts` |
| 10 | **Low** | `database.py` | `ecosystem_counts` stored as JSON string — works but makes queries harder |

### What's Missing Entirely

- No scan progress indicator (WebSocket or polling)
- No exposure catalog management (download, select, update)
- No real-time log streaming during scan
- No multi-scan comparison
- No scheduled/automated scanning
- No `bumblebee version` check on backend startup

---

## 2. Bug Fixes (P0)

These must be fixed before anything else. The app will produce wrong results without them.

### 2.1 Fix Ecosystem List

**File:** `frontend/src/pages/Scan.tsx`

Replace the hardcoded `ALL_ECOSYSTEMS` with bumblebee's actual supported ecosystems:

```typescript
// BEFORE (wrong):
const ALL_ECOSYSTEMS = [
  'npm', 'pypi', 'go', 'cargo', 'maven', 'nuget', 'rubygems', 'cocoapods',
]

// AFTER (correct):
const ALL_ECOSYSTEMS = [
  'npm', 'pypi', 'go', 'rubygems', 'packagist',
  'mcp', 'editor-extension', 'browser-extension',
]
```

Update presets accordingly:

```typescript
const PRESETS: Preset[] = [
  {
    label: 'Baseline',
    description: 'Quick scan of common ecosystems',
    profile: 'baseline',
    ecosystems: ['npm', 'pypi'],
    roots: [],
  },
  {
    label: 'Project',
    description: 'Scan project dependencies',
    profile: 'project',
    ecosystems: ['npm', 'pypi', 'go', 'rubygems', 'packagist'],
    roots: ['.'],
  },
  {
    label: 'npm only',
    description: 'Only JavaScript ecosystem',
    profile: 'baseline',
    ecosystems: ['npm'],
    roots: [],
  },
  {
    label: 'Deep',
    description: 'Full scan including MCP and extensions',
    profile: 'deep',
    ecosystems: ['npm', 'pypi', 'go', 'rubygems', 'packagist', 'mcp', 'editor-extension', 'browser-extension'],
    roots: [],
  },
]
```

### 2.2 Fix FindingRecord Model

**File:** `backend/bumblebee_gui/models.py`

```python
# BEFORE (wrong fields):
class FindingRecord(BaseModel):
    package: str
    version: str
    ecosystem: str
    severity: str
    cve: Optional[str] = None
    description: str
    found_in: str

# AFTER (matches bumblebee's actual NDJSON output):
class FindingRecord(BaseModel):
    package: str
    version: str
    ecosystem: str
    severity: str
    catalog_id: str
    catalog_name: str
    evidence: str
    source_file: Optional[str] = None
    source_type: Optional[str] = None
    root_kind: Optional[str] = None
    project_path: Optional[str] = None
    confidence: Optional[str] = None
```

### 2.3 Fix PackageRecord Model

**File:** `backend/bumblebee_gui/models.py`

```python
# BEFORE:
class PackageRecord(BaseModel):
    name: str
    ecosystem: str
    version: str
    source: str

# AFTER:
class PackageRecord(BaseModel):
    name: str
    ecosystem: str
    version: str
    source_type: Optional[str] = None
    source_file: Optional[str] = None
    project_path: Optional[str] = None
    package_manager: Optional[str] = None
    confidence: Optional[str] = None
    has_lifecycle_scripts: Optional[bool] = None
```

### 2.4 Fix Scanner NDJSON Parsing

**File:** `backend/bumblebee_gui/scanner.py`

Update `get_scan_findings()` to map correct field names:

```python
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
                        package=record.get("package_name", "unknown"),
                        version=record.get("version", "unknown"),
                        ecosystem=record.get("ecosystem", "unknown"),
                        severity=record.get("severity", "info"),
                        catalog_id=record.get("catalog_id", "unknown"),
                        catalog_name=record.get("catalog_name", "unknown"),
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
```

Update `get_scan_packages()` similarly:

```python
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
                        name=record.get("package_name", "unknown"),
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
```

### 2.5 Fix Findings Page to Use Correct Fields

**File:** `frontend/src/pages/Findings.tsx`

Update all references from `found_in` to `source_file`, add `catalog_name` and `evidence` display:

```tsx
// BEFORE:
<div className="text-sm text-muted-foreground">{f.found_in}</div>

// AFTER:
<div className="text-sm text-muted-foreground">{f.source_file}</div>
<div className="text-xs text-muted-foreground mt-1">{f.catalog_name}</div>
<div className="text-xs text-muted-foreground italic mt-1">{f.evidence}</div>
```

### 2.6 Fix Results Page to Use Correct Fields

**File:** `frontend/src/pages/Results.tsx`

Update table columns to include new fields:

```tsx
// Add columns for: source_type, project_path, confidence
// Update CSV export to include new fields
```

---

## 3. Architecture Improvements (P1)

### 3.1 Scan Progress via SSE (Server-Sent Events)

**Problem:** `POST /api/scans` blocks for minutes with no feedback.

**Solution:** Use SSE for real-time progress streaming.

**File:** `backend/bumblebee_gui/main.py`

```python
import asyncio
from fastapi.responses import StreamingResponse

@app.post("/api/scans", response_model=ScanRecord, status_code=201)
async def create_scan(request: ScanRequest):
    """Trigger a new scan and stream progress via SSE."""
    scan_id = await insert_scan(
        profile=request.profile,
        status=ScanStatus.running,
    )

    async def progress_stream():
        """Stream scan progress as SSE events."""
        cmd = build_command(request)
        ndjson_path = generate_ndjson_path(request.profile)

        yield f"data: {json.dumps({'status': 'running', 'scan_id': scan_id})}\n\n"

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # Stream line-by-line as it comes
        package_count = 0
        finding_count = 0
        async for line in process.stdout:
            decoded = line.decode().strip()
            if not decoded:
                continue

            try:
                record = json.loads(decoded)
                record_type = record.get("record_type", "")

                if record_type == "package":
                    package_count += 1
                    # Save to temp file incrementally
                    with open(ndjson_path, "a") as f:
                        f.write(decoded + "\n")
                    yield f"data: {json.dumps({'type': 'progress', 'packages': package_count, 'findings': finding_count})}\n\n"

                elif record_type == "finding":
                    finding_count += 1
                    with open(ndjson_path, "a") as f:
                        f.write(decoded + "\n")
                    yield f"data: {json.dumps({'type': 'finding', 'package': record.get('package_name'), 'severity': record.get('severity')})}\n\n"

                elif record_type == "scan_summary":
                    with open(ndjson_path, "a") as f:
                        f.write(decoded + "\n")

            except json.JSONDecodeError:
                continue

        await process.wait()

        if process.returncode != 0:
            stderr_output = (await process.stderr.read()).decode()
            await update_scan_status(scan_id, status=ScanStatus.failed)
            yield f"data: {json.dumps({'status': 'failed', 'error': stderr_output})}\n\n"
            return

        # Parse summary
        packages, findings = parse_ndjson_output(Path(ndjson_path).read_text())
        summary = calculate_summary(packages, findings)
        await update_scan_status(
            scan_id=scan_id,
            status=ScanStatus.completed,
            summary=summary,
            ndjson_path=str(ndjson_path),
        )

        yield f"data: {json.dumps({'status': 'completed', 'scan_id': scan_id, 'summary': summary.model_dump()})}\n\n"

    return StreamingResponse(
        progress_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
```

**File:** `frontend/src/lib/api.ts`

```typescript
export async function createScanWithProgress(
  request: ScanRequest,
  onProgress: (data: ScanProgress) => void,
  onComplete: (scan: ScanRecord) => void,
  onError: (error: string) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

    for (const line of lines) {
      const data = JSON.parse(line.slice(6))

      if (data.status === 'completed') {
        onComplete(data as ScanRecord)
      } else if (data.status === 'failed') {
        onError(data.error)
      } else {
        onProgress(data)
      }
    }
  }
}
```

**File:** `frontend/src/stores/scanStore.ts`

```typescript
// Add progress state to store
interface ScanState {
  // ... existing fields ...
  scanProgress: {
    packages: number
    findings: number
    status: 'idle' | 'running' | 'completed' | 'failed'
  }
  setScanProgress: (progress: Partial<ScanState['scanProgress']>) => void
}
```

### 3.2 Exposure Catalog Management

**New file:** `backend/bumblebee_gui/catalogs.py`

```python
"""Exposure catalog management — download, list, validate catalogs."""
import json
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel

CATALOG_DIR = Path.home() / ".bumblebee-gui" / "catalogs"

# Known catalogs from Perplexity's threat_intel repo
KNOWN_CATALOGS = [
    {"id": "antv-mini-shai-hulud", "name": "ANTV Mini Shai Hulud", "url": "https://raw.githubusercontent.com/perplexityai/bumblebee/main/threat_intel/antv-mini-shai-hulud.json"},
    {"id": "gemstuffer", "name": "Gemstuffer", "url": "https://raw.githubusercontent.com/perplexityai/bumblebee/main/threat_intel/gemstuffer.json"},
    {"id": "laravel-lang-2026-05-23", "name": "Laravel Lang", "url": "https://raw.githubusercontent.com/perplexityai/bumblebee/main/threat_intel/laravel-lang-2026-05-23.json"},
    {"id": "mini-shai-hulud", "name": "Mini Shai Hulud", "url": "https://raw.githubusercontent.com/perplexityai/bumblebee/main/threat_intel/mini-shai-hulud.json"},
    {"id": "node-ipc-credential-stealer", "name": "Node IPC Credential Stealer", "url": "https://raw.githubusercontent.com/perplexityai/bumblebee/main/threat_intel/node-ipc-credential-stealer.json"},
    {"id": "nx-console-vscode-2026-05-18", "name": "NX Console VSCode", "url": "https://raw.githubusercontent.com/perplexityai/bumblebee/main/threat_intel/nx-console-vscode-2026-05-18.json"},
    {"id": "shopsprint-decimal-typosquat", "name": "ShopSprint Decimal Typosquat", "url": "https://raw.githubusercontent.com/perplexityai/bumblebee/main/threat_intel/shopsprint-decimal-typosquat.json"},
    {"id": "trapdoor-crypto-stealer", "name": "Trapdoor Crypto Stealer", "url": "https://raw.githubusercontent.com/perplexityai/bumblebee/main/threat_intel/trapdoor-crypto-stealer.json"},
]


class CatalogInfo(BaseModel):
    id: str
    name: str
    downloaded: bool
    last_updated: Optional[str] = None
    entry_count: Optional[int] = None


def list_catalogs() -> List[CatalogInfo]:
    """List all known catalogs with download status."""
    CATALOG_DIR.mkdir(parents=True, exist_ok=True)
    results = []

    for cat in KNOWN_CATALOGS:
        local_path = CATALOG_DIR / f"{cat['id']}.json"
        downloaded = local_path.exists()
        entry_count = None
        last_updated = None

        if downloaded:
            try:
                data = json.loads(local_path.read_text())
                entry_count = len(data.get("entries", []))
                last_updated = local_path.stat().st_mtime
            except Exception:
                pass

        results.append(CatalogInfo(
            id=cat["id"],
            name=cat["name"],
            downloaded=downloaded,
            last_updated=str(last_updated) if last_updated else None,
            entry_count=entry_count,
        ))

    return results


async def download_catalog(catalog_id: str) -> Path:
    """Download a catalog from GitHub."""
    import httpx

    cat = next((c for c in KNOWN_CATALOGS if c["id"] == catalog_id), None)
    if not cat:
        raise ValueError(f"Unknown catalog: {catalog_id}")

    CATALOG_DIR.mkdir(parents=True, exist_ok=True)
    local_path = CATALOG_DIR / f"{catalog_id}.json"

    async with httpx.AsyncClient() as client:
        response = await client.get(cat["url"])
        response.raise_for_status()
        local_path.write_text(response.text)

    return local_path


def get_catalog_path(catalog_id: str) -> Optional[Path]:
    """Get local path for a catalog."""
    local_path = CATALOG_DIR / f"{catalog_id}.json"
    return local_path if local_path.exists() else None


def get_all_catalogs_path() -> Optional[Path]:
    """Get directory path for all catalogs (for --exposure-catalog flag)."""
    return CATALOG_DIR if CATALOG_DIR.exists() else None
```

**New API endpoints in `main.py`:**

```python
from .catalogs import list_catalogs, download_catalog, get_catalog_path, get_all_catalogs_path

@app.get("/api/catalogs", response_model=list[CatalogInfo])
async def list_exposure_catalogs():
    """List all known exposure catalogs."""
    return list_catalogs()


@app.post("/api/catalogs/{catalog_id}/download")
async def download_exposure_catalog(catalog_id: str):
    """Download a catalog from GitHub."""
    path = await download_catalog(catalog_id)
    return {"status": "ok", "path": str(path), "catalog_id": catalog_id}


@app.post("/api/catalogs/download-all")
async def download_all_catalogs():
    """Download all known catalogs."""
    downloaded = []
    for cat in KNOWN_CATALOGS:
        path = await download_catalog(cat["id"])
        downloaded.append(cat["id"])
    return {"status": "ok", "downloaded": downloaded}
```

**Update Scan page** to use catalog picker instead of raw text input:

```tsx
// In Scan.tsx, replace the exposure catalog text input with:
const [catalogs, setCatalogs] = useState<CatalogInfo[]>([])
const [selectedCatalog, setSelectedCatalog] = useState<string>('')

useEffect(() => {
  fetch(`${API_BASE}/api/catalogs`)
    .then(r => r.json())
    .then(setCatalogs)
}, [])

// In the exposure catalog section:
<CollapsibleSection title="Exposure catalog" open={exposureOpen} onToggle={() => setExposureOpen(v => !v)}>
  <div className="space-y-3">
    <p className="text-sm text-muted-foreground">
      Select a threat catalog to cross-reference against your packages.
    </p>
    <div className="grid gap-2">
      {catalogs.map(cat => (
        <label key={cat.id} className="flex items-center gap-3 rounded-md border px-3 py-2 hover:bg-accent cursor-pointer">
          <input
            type="radio"
            name="catalog"
            value={cat.id}
            checked={selectedCatalog === cat.id}
            onChange={() => setSelectedCatalog(cat.id)}
          />
          <div className="flex-1">
            <div className="text-sm font-medium">{cat.name}</div>
            <div className="text-xs text-muted-foreground">
              {cat.downloaded ? `${cat.entry_count} entries` : 'Not downloaded'}
            </div>
          </div>
          {!cat.downloaded && (
            <Button size="sm" variant="outline" onClick={() => downloadCatalog(cat.id)}>
              Download
            </Button>
          )}
        </label>
      ))}
    </div>
  </div>
</CollapsibleSection>
```

### 3.3 Lazy NDJSON Loading with Pagination

**File:** `backend/bumblebee_gui/scanner.py`

```python
async def get_scan_packages_paginated(
    scan_id: int,
    ndjson_path: str,
    offset: int = 0,
    limit: int = 100,
    ecosystem: Optional[str] = None,
    search: Optional[str] = None,
) -> tuple[List[PackageRecord], int]:
    """Load packages with pagination for large datasets."""
    path = Path(ndjson_path)
    if not path.exists():
        return [], 0

    packages = []
    total = 0

    for line in path.read_text().strip().split("\n"):
        if not line:
            continue
        try:
            record = json.loads(line)
            if record.get("record_type") != "package":
                continue

            # Apply filters
            if ecosystem and record.get("ecosystem") != ecosystem:
                continue
            if search and search.lower() not in record.get("package_name", "").lower():
                continue

            total += 1

            # Apply pagination
            if total > offset and len(packages) < limit:
                packages.append(PackageRecord(
                    name=record.get("package_name", "unknown"),
                    ecosystem=record.get("ecosystem", "unknown"),
                    version=record.get("version", "unknown"),
                    source_type=record.get("source_type"),
                    source_file=record.get("source_file"),
                    project_path=record.get("project_path"),
                    package_manager=record.get("package_manager"),
                    confidence=record.get("confidence"),
                    has_lifecycle_scripts=record.get("has_lifecycle_scripts"),
                ))
        except json.JSONDecodeError:
            continue

    return packages, total
```

Update the API endpoint:

```python
@app.get("/api/scans/{scan_id}/packages")
async def get_packages(
    scan_id: int,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    ecosystem: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
):
    """Get packages from a scan with pagination."""
    scan = await get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail=f"Scan {scan_id} not found")
    if not scan.ndjson_path:
        raise HTTPException(status_code=404, detail="No data file for this scan")

    packages, total = await get_scan_packages_paginated(
        scan_id, scan.ndjson_path, offset, limit, ecosystem, search
    )
    return {
        "packages": packages,
        "total": total,
        "offset": offset,
        "limit": limit,
    }
```

---

## 4. Feature Enhancements (P2)

### 4.1 Scan History with Comparison

Allow users to compare two scans side by side to see what changed.

**New page:** `frontend/src/pages/Compare.tsx`

```tsx
// Compare two scans — show:
// - New packages added
// - Packages removed
// - Findings that appeared/disappeared
// - Ecosystem distribution changes
```

**New API endpoint:**

```python
@app.get("/api/scans/compare")
async def compare_scans(scan_id_a: int, scan_id_b: int):
    """Compare two scans and return differences."""
    # Load both scans' packages
    # Diff by (ecosystem, package_name)
    # Return: added, removed, unchanged
```

### 4.2 Scheduled Scanning

Allow users to schedule recurring scans via the GUI.

**New table in database:**

```sql
CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    profile TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    last_run TEXT,
    created_at TEXT NOT NULL
);
```

**New API endpoints:**

```python
@app.get("/api/schedules")
async def list_schedules(): ...

@app.post("/api/schedules")
async def create_schedule(request: ScheduleRequest): ...

@app.delete("/api/schedules/{schedule_id}")
async def delete_schedule(schedule_id: int): ...

@app.post("/api/schedules/{schedule_id}/run")
async def run_schedule_now(schedule_id: int): ...
```

### 4.3 Bumblebee Version Check

On backend startup, verify bumblebee binary is available and report version.

**File:** `backend/bumblebee_gui/main.py`

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize DB and check bumblebee."""
    await init_db()

    # Check bumblebee binary
    try:
        process = await asyncio.create_subprocess_exec(
            BINARY_PATH, "version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await process.communicate()
        version_info = stdout.decode().strip()
        logger.info(f"Bumblebee binary: {version_info}")
    except FileNotFoundError:
        logger.error(f"Bumblebee binary not found at {BINARY_PATH}")
        logger.error("Set BUMBLEBEE_BINARY env var or install bumblebee")

    yield
```

Add version to health endpoint:

```python
@app.get("/api/health")
async def health():
    """Health check with bumblebee version."""
    bumblebee_version = "unknown"
    try:
        process = await asyncio.create_subprocess_exec(
            BINARY_PATH, "version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await process.communicate()
        bumblebee_version = stdout.decode().strip()
    except Exception:
        pass

    return {
        "status": "ok",
        "version": "0.1.0",
        "bumblebee_version": bumblebee_version,
    }
```

### 4.4 Scan Progress UI Component

**New file:** `frontend/src/components/ScanProgress.tsx`

```tsx
interface ScanProgressProps {
  status: 'idle' | 'running' | 'completed' | 'failed'
  packages: number
  findings: number
  elapsedTime: number
}

export function ScanProgress({ status, packages, findings, elapsedTime }: ScanProgressProps) {
  if (status === 'idle') return null

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === 'running' && <Spinner />}
          {status === 'completed' && <CheckCircle className="text-green-500" />}
          {status === 'failed' && <AlertCircle className="text-red-500" />}
          <span className="font-medium capitalize">{status}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {formatDuration(elapsedTime)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-2xl font-bold">{packages.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Packages found</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-500">{findings}</div>
          <div className="text-sm text-muted-foreground">Threats found</div>
        </div>
      </div>

      {status === 'running' && (
        <div className="w-full bg-secondary rounded-full h-2">
          <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '100%' }} />
        </div>
      )}
    </div>
  )
}
```

---

## 5. Polish & DX (P3)

### 5.1 TypeScript Types Alignment

**File:** `frontend/src/lib/api.ts`

Ensure all types match the updated backend models:

```typescript
export interface PackageRecord {
  name: string
  ecosystem: string
  version: string
  source_type?: string
  source_file?: string
  project_path?: string
  package_manager?: string
  confidence?: string
  has_lifecycle_scripts?: boolean
}

export interface FindingRecord {
  package: string
  version: string
  ecosystem: string
  severity: string
  catalog_id: string
  catalog_name: string
  evidence: string
  source_file?: string
  source_type?: string
  root_kind?: string
  project_path?: string
  confidence?: string
}

export interface ScanRecord {
  id: number
  timestamp: string
  profile: 'baseline' | 'project' | 'deep'
  status: 'pending' | 'running' | 'completed' | 'failed'
  summary?: ScanSummary
  ndjson_path?: string
}

export interface ScanSummary {
  total_packages: number
  ecosystems_found: number
  findings_count: number
  ecosystem_counts: Record<string, number>
}
```

### 5.2 Error Handling Improvements

**File:** `backend/bumblebee_gui/scanner.py`

```python
import logging

logger = logging.getLogger(__name__)

async def run_scan(request: ScanRequest) -> tuple[ScanSummary, Path]:
    """Execute a Bumblebee scan and return results."""
    ensure_dirs()

    cmd = build_command(request)
    logger.info(f"Running scan: {' '.join(cmd)}")

    ndjson_path = generate_ndjson_path(request.profile)

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
    except FileNotFoundError:
        raise RuntimeError(
            f"Bumblebee binary not found at {BINARY_PATH}. "
            "Install bumblebee or set BUMBLEBEE_BINARY env var."
        )
    except asyncio.TimeoutError:
        raise RuntimeError(f"Scan timed out after {request.max_duration}")

    if process.returncode != 0:
        error_msg = stderr.decode().strip()
        logger.error(f"Bumblebee scan failed (exit {process.returncode}): {error_msg}")
        raise RuntimeError(f"Bumblebee scan failed: {error_msg}")

    # Save raw output
    ndjson_path.write_bytes(stdout)
    logger.info(f"Scan output saved to {ndjson_path} ({len(stdout)} bytes)")

    # Parse and summarize
    packages, findings = parse_ndjson_output(stdout.decode())
    summary = calculate_summary(packages, findings)
    logger.info(f"Scan complete: {summary.total_packages} packages, {summary.findings_count} findings")

    return summary, ndjson_path
```

### 5.3 CORS Configuration

**File:** `backend/bumblebee_gui/main.py`

```python
# BEFORE (too permissive):
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AFTER (local-only):
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 5.4 README Updates

Update README to reflect:
- Correct ecosystem list
- New catalog management features
- Scan progress UI
- Correct API endpoints with new response shapes

---

## 6. File-by-File Change List

### Backend Changes

| File | Changes | Priority |
|------|---------|----------|
| `models.py` | Fix `FindingRecord` fields, fix `PackageRecord` fields | P0 |
| `scanner.py` | Fix field mapping in `get_scan_packages()` and `get_scan_findings()`, add pagination, add logging | P0 + P1 |
| `main.py` | Fix CORS, add SSE streaming for scan progress, add catalog endpoints, add version check, add pagination params | P1 |
| `database.py` | Add schedules table (for P2), no critical changes | P2 |
| **NEW** `catalogs.py` | Exposure catalog management — list, download, validate | P1 |

### Frontend Changes

| File | Changes | Priority |
|------|---------|----------|
| `Scan.tsx` | Fix `ALL_ECOSYSTEMS`, fix presets, replace catalog text input with picker | P0 |
| `Findings.tsx` | Fix field references (`found_in` → `source_file`), add `catalog_name` + `evidence` display | P0 |
| `Results.tsx` | Add new columns (`source_type`, `project_path`, `confidence`), update CSV export | P0 |
| `lib/api.ts` | Update TypeScript types, add SSE progress function, add catalog API functions | P1 |
| `stores/scanStore.ts` | Add scan progress state, add catalog state | P1 |
| **NEW** `ScanProgress.tsx` | Real-time scan progress component | P1 |
| **NEW** `Compare.tsx` | Scan comparison page | P2 |
| `App.tsx` | Add Compare route | P2 |

### Documentation

| File | Changes | Priority |
|------|---------|----------|
| `README.md` | Update ecosystem list, add catalog docs, update API reference | P1 |
| `handoff-bumblebee-gui.md` | Update status, add known issues section | P1 |

---

## 7. Testing Checklist

### Backend

- [ ] `GET /api/health` returns bumblebee version
- [ ] `POST /api/scans` with baseline profile completes successfully
- [ ] `POST /api/scans` with deep profile streams progress via SSE
- [ ] `GET /api/scans` returns list of scans
- [ ] `GET /api/scans/{id}` returns scan detail
- [ ] `GET /api/scans/{id}/packages` returns paginated packages
- [ ] `GET /api/scans/{id}/packages?ecosystem=npm` filters correctly
- [ ] `GET /api/scans/{id}/findings` returns correct finding fields
- [ ] `GET /api/scans/{id}/export?format=json` downloads valid JSON
- [ ] `GET /api/scans/{id}/export?format=csv` downloads valid CSV
- [ ] `DELETE /api/scans/{id}` removes scan and NDJSON file
- [ ] `GET /api/catalogs` returns all known catalogs with status
- [ ] `POST /api/catalogs/{id}/download` downloads catalog
- [ ] Scan with `--exposure-catalog` produces findings
- [ ] Scan with `--findings-only` suppresses package records
- [ ] Error handling: bumblebee not installed → clear error message
- [ ] Error handling: invalid profile → 422 with details
- [ ] Error handling: scan timeout → proper error response

### Frontend

- [ ] Dashboard shows correct stats from latest scan
- [ ] Scan page: all ecosystem checkboxes match bumblebee's supported ecosystems
- [ ] Scan page: presets configure correct ecosystems and profile
- [ ] Scan page: exposure catalog picker shows all catalogs
- [ ] Scan page: exposure catalog download works
- [ ] Scan progress shows real-time package/finding counts
- [ ] Results page: table columns match backend response
- [ ] Results page: search filters packages correctly
- [ ] Results page: ecosystem filter works
- [ ] Results page: pagination works
- [ ] Results page: CSV export includes all fields
- [ ] Findings page: severity badges display correctly
- [ ] Findings page: catalog_name and evidence are visible
- [ ] Findings page: filter by severity works
- [ ] Findings page: filter by ecosystem works
- [ ] Settings page: theme toggle persists
- [ ] All pages: responsive on mobile
- [ ] All pages: dark mode looks correct

### Integration

- [ ] Full flow: configure scan → start → see progress → view results → export
- [ ] Full flow: download catalog → run exposure scan → view findings
- [ ] Full flow: compare two scans → see differences
- [ ] Docker: `docker compose up` starts both services
- [ ] Docker: frontend connects to backend correctly
- [ ] Mac: binary runs natively (no Docker)
- [ ] Mac: scan of `$HOME` completes within 10 minutes

---

## 8. Reference: Bumblebee NDJSON Format

### Package Record

```json
{
  "record_type": "package",
  "record_id": "package:...",
  "schema_version": "0.1.0",
  "scanner_name": "bumblebee",
  "scanner_version": "v0.1.1",
  "run_id": "...",
  "scan_time": "2026-05-15T18:22:01.482Z",
  "endpoint": {
    "hostname": "alex-mbp",
    "os": "darwin",
    "arch": "arm64",
    "username": "alex",
    "uid": "501",
    "device_id": "MDM-7F4A2B"
  },
  "profile": "project",
  "ecosystem": "npm",
  "package_name": "@tanstack/query-core",
  "normalized_name": "@tanstack/query-core",
  "version": "5.59.20",
  "project_path": "/Users/alex/code/web-app",
  "root_kind": "project_root",
  "package_manager": "pnpm",
  "source_type": "pnpm-lockfile",
  "source_file": "/Users/alex/code/web-app/pnpm-lock.yaml",
  "has_lifecycle_scripts": false,
  "confidence": "high"
}
```

### Finding Record

```json
{
  "record_type": "finding",
  "record_id": "finding:...",
  "schema_version": "0.1.0",
  "scanner_name": "bumblebee",
  "scanner_version": "v0.1.1",
  "run_id": "...",
  "scan_time": "2026-05-15T18:22:01.482Z",
  "endpoint": {
    "hostname": "alex-mbp",
    "os": "darwin",
    "arch": "arm64",
    "username": "alex",
    "uid": "501",
    "device_id": "MDM-7F4A2B"
  },
  "profile": "deep",
  "finding_type": "package_exposure",
  "severity": "critical",
  "catalog_id": "advisory-2026-0042",
  "catalog_name": "example-pkg 1.2.3 (compromised release)",
  "ecosystem": "npm",
  "package_name": "example-pkg",
  "normalized_name": "example-pkg",
  "version": "1.2.3",
  "root_kind": "deep_home_root",
  "project_path": "/Users/alex/code/web-app",
  "source_type": "pnpm-lockfile",
  "source_file": "/Users/alex/code/web-app/pnpm-lock.yaml",
  "confidence": "high",
  "evidence": "exact name+version match (version=1.2.3)"
}
```

### Scan Summary Record

```json
{
  "record_type": "scan_summary",
  "record_id": "scan_summary:...",
  "schema_version": "0.1.0",
  "run_id": "...",
  "scan_time": "2026-05-15T18:22:01.482Z",
  "profile": "deep",
  "status": "complete",
  "files_considered": 86696,
  "records": 2547,
  "findings": 0,
  "suppressed": 0,
  "duplicates": 0,
  "diagnostics": 2,
  "timed_out": false,
  "duration_ms": 437
}
```

### Supported Ecosystems

| Ecosystem | `ecosystem` value | Sources |
|-----------|-------------------|---------|
| npm | `npm` | `package-lock.json`, `npm-shrinkwrap.json`, `node_modules/.package-lock.json`, `node_modules/<pkg>/package.json` |
| pnpm | `npm` | `pnpm-lock.yaml`, `.pnpm/.../package.json` |
| Yarn | `npm` | `yarn.lock` (Classic + Berry) |
| Bun | `npm` | `bun.lock` |
| PyPI | `pypi` | `*.dist-info/METADATA`, `INSTALLER`, `direct_url.json`, `*.egg-info/PKG-INFO` |
| Go modules | `go` | `go.sum`, `go.mod` |
| RubyGems | `rubygems` | `Gemfile.lock`, installed `*.gemspec` |
| Composer | `packagist` | `composer.lock`, `vendor/composer/installed.json` |
| MCP | `mcp` | `mcp.json`, `.mcp.json`, `claude_desktop_config.json`, etc. |
| Editor extensions | `editor-extension` | VS Code, Cursor, Windsurf, VSCodium manifests |
| Browser extensions | `browser-extension` | Chromium-family (`manifest.json`) and Firefox (`extensions.json`) |

---

## Execution Order

The refactor should be done in this order to minimize breakage:

1. **Fix models.py** — correct field names (P0)
2. **Fix scanner.py** — update field mapping (P0)
3. **Fix Scan.tsx** — correct ecosystem list (P0)
4. **Fix Findings.tsx** — correct field references (P0)
5. **Fix Results.tsx** — add new columns (P0)
6. **Fix lib/api.ts** — align TypeScript types (P0)
7. **Add catalogs.py** — exposure catalog management (P1)
8. **Add SSE streaming** — scan progress (P1)
9. **Add ScanProgress.tsx** — progress UI (P1)
10. **Add pagination** — lazy NDJSON loading (P1)
11. **Update CORS** — local-only origins (P1)
12. **Update README** — correct documentation (P1)
13. **Add Compare.tsx** — scan comparison (P2)
14. **Add scheduled scanning** — cron integration (P2)
15. **Test everything** — run through checklist (P0-P2)

---

*This document is the single source of truth for the bumblebee-gui refactor. Update it as work progresses.*
