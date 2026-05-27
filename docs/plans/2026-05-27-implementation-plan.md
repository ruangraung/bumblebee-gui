# Bumblebee GUI Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Build a working web GUI for Bumblebee that runs on Mac, with Docker-based development on VPS.

**Architecture:** FastAPI backend wraps Bumblebee CLI via subprocess, React frontend with shadcn/ui provides the UI. Data stored as NDJSON files + SQLite metadata.

**Tech Stack:** Python 3.11+, FastAPI, React 18, TypeScript, TailwindCSS, shadcn/ui, Recharts, Zustand, SQLite, Docker

**Design Document:** `docs/plans/2026-05-27-bumblebee-gui-design.md`

---

## Phase 1: Docker Development Environment

### Task 1: Create Docker Compose Configuration

**Files:**
- Create: `docker-compose.yml`
- Create: `Dockerfile.backend`
- Create: `Dockerfile.frontend`

**Step 1: Create backend Dockerfile**

```dockerfile
# Dockerfile.backend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    tar \
    && rm -rf /var/lib/apt/lists/*

# Download Bumblebee binary
ARG BUMBLEBEE_VERSION=0.1.1
RUN curl -L "https://github.com/perplexityai/bumblebee/releases/download/v${BUMBLEBEE_VERSION}/bumblebee_${BUMBLEBEE_VERSION}_linux_amd64.tar.gz" \
    -o /tmp/bumblebee.tar.gz \
    && tar -xzf /tmp/bumblebee.tar.gz -C /usr/local/bin/ \
    && rm /tmp/bumblebee.tar.gz \
    && chmod +x /usr/local/bin/bumblebee

# Verify installation
RUN bumblebee version

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ .

# Create data directory
RUN mkdir -p /root/.bumblebee-gui/scans

EXPOSE 8000

CMD ["uvicorn", "bumblebee_gui.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**Step 2: Create frontend Dockerfile**

```dockerfile
# Dockerfile.frontend
FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy application code
COPY frontend/ .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

**Step 3: Create docker-compose.yml**

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - bumblebee-data:/root/.bumblebee-gui
    environment:
      - BUMBLEBEE_DATA_DIR=/root/.bumblebee-gui

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend

volumes:
  bumblebee-data:
```

**Step 4: Test Docker setup**

Run: `docker compose build`
Expected: Both images build successfully, Bumblebee binary installs

Run: `docker compose up -d`
Expected: Both services start

Run: `docker compose ps`
Expected: Both services running

**Step 5: Commit**

```bash
git add docker-compose.yml Dockerfile.backend Dockerfile.frontend
git commit -m "feat: add Docker development environment"
```

---

### Task 2: Create Backend Project Structure

**Files:**
- Create: `backend/bumblebee_gui/__init__.py`
- Create: `backend/bumblebee_gui/main.py`
- Create: `backend/bumblebee_gui/models.py`
- Create: `backend/bumblebee_gui/scanner.py`
- Create: `backend/bumblebee_gui/database.py`
- Create: `backend/requirements.txt`

**Step 1: Create requirements.txt**

```
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
pydantic>=2.5.0
python-multipart>=0.0.6
aiosqlite>=0.19.0
```

**Step 2: Create __init__.py**

```python
# backend/bumblebee_gui/__init__.py
"""Bumblebee GUI - Web interface for Bumblebee supply chain scanner."""

__version__ = "0.1.0"
```

**Step 3: Create models.py**

```python
# backend/bumblebee_gui/models.py
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ScanProfile(str, Enum):
    baseline = "baseline"
    project = "project"
    deep = "deep"


class ScanStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class ScanRequest(BaseModel):
    profile: ScanProfile
    ecosystems: Optional[List[str]] = None
    roots: Optional[List[str]] = None
    exposure_catalog: Optional[str] = None
    findings_only: bool = False
    max_duration: Optional[str] = "10m"


class ScanSummary(BaseModel):
    total_packages: int
    ecosystems_found: int
    findings_count: int
    ecosystem_counts: dict[str, int]


class ScanRecord(BaseModel):
    id: int
    timestamp: datetime
    profile: ScanProfile
    status: ScanStatus
    summary: Optional[ScanSummary] = None
    ndjson_path: Optional[str] = None


class PackageRecord(BaseModel):
    name: str
    ecosystem: str
    version: str
    source: str


class FindingRecord(BaseModel):
    package: str
    version: str
    ecosystem: str
    severity: str
    cve: Optional[str] = None
    description: str
    found_in: str
```

**Step 4: Create database.py**

```python
# backend/bumblebee_gui/database.py
import aiosqlite
import os
from pathlib import Path
from datetime import datetime
from typing import List, Optional

from .models import ScanRecord, ScanProfile, ScanStatus, ScanSummary

DB_DIR = Path(os.environ.get("BUMBLEBEE_DATA_DIR", Path.home() / ".bumblebee-gui"))
DB_PATH = DB_DIR / "bumblebee-gui.db"


async def init_db():
    """Initialize the database with required tables."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                profile TEXT NOT NULL,
                status TEXT NOT NULL,
                total_packages INTEGER,
                ecosystems_found INTEGER,
                findings_count INTEGER,
                ecosystem_counts TEXT,
                ndjson_path TEXT
            )
        """)
        await db.commit()


async def insert_scan(
    profile: ScanProfile,
    status: ScanStatus,
    summary: Optional[ScanSummary] = None,
    ndjson_path: Optional[str] = None,
) -> int:
    """Insert a new scan record and return its ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            INSERT INTO scans (timestamp, profile, status, total_packages, 
                             ecosystems_found, findings_count, ecosystem_counts, ndjson_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                datetime.utcnow().isoformat(),
                profile.value,
                status.value,
                summary.total_packages if summary else None,
                summary.ecosystems_found if summary else None,
                summary.findings_count if summary else None,
                str(summary.ecosystem_counts) if summary else None,
                ndjson_path,
            ),
        )
        await db.commit()
        return cursor.lastrowid


async def update_scan_status(
    scan_id: int,
    status: ScanStatus,
    summary: Optional[ScanSummary] = None,
):
    """Update scan status and optionally summary."""
    async with aiosqlite.connect(DB_PATH) as db:
        if summary:
            await db.execute(
                """
                UPDATE scans 
                SET status = ?, total_packages = ?, ecosystems_found = ?,
                    findings_count = ?, ecosystem_counts = ?
                WHERE id = ?
                """,
                (
                    status.value,
                    summary.total_packages,
                    summary.ecosystems_found,
                    summary.findings_count,
                    str(summary.ecosystem_counts),
                    scan_id,
                ),
            )
        else:
            await db.execute(
                "UPDATE scans SET status = ? WHERE id = ?",
                (status.value, scan_id),
            )
        await db.commit()


async def get_scans(limit: int = 20) -> List[ScanRecord]:
    """Get recent scans."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM scans ORDER BY timestamp DESC LIMIT ?", (limit,)
        )
        rows = await cursor.fetchall()
        return [
            ScanRecord(
                id=row["id"],
                timestamp=datetime.fromisoformat(row["timestamp"]),
                profile=ScanProfile(row["profile"]),
                status=ScanStatus(row["status"]),
                summary=ScanSummary(
                    total_packages=row["total_packages"] or 0,
                    ecosystems_found=row["ecosystems_found"] or 0,
                    findings_count=row["findings_count"] or 0,
                    ecosystem_counts=eval(row["ecosystem_counts"]) if row["ecosystem_counts"] else {},
                )
                if row["total_packages"] is not None
                else None,
                ndjson_path=row["ndjson_path"],
            )
            for row in rows
        ]


async def get_scan(scan_id: int) -> Optional[ScanRecord]:
    """Get a specific scan by ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM scans WHERE id = ?", (scan_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        return ScanRecord(
            id=row["id"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
            profile=ScanProfile(row["profile"]),
            status=ScanStatus(row["status"]),
            summary=ScanSummary(
                total_packages=row["total_packages"] or 0,
                ecosystems_found=row["ecosystems_found"] or 0,
                findings_count=row["findings_count"] or 0,
                ecosystem_counts=eval(row["ecosystem_counts"]) if row["ecosystem_counts"] else {},
            )
            if row["total_packages"] is not None
            else None,
            ndjson_path=row["ndjson_path"],
        )


async def delete_scan(scan_id: int) -> bool:
    """Delete a scan record."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("DELETE FROM scans WHERE id = ?", (scan_id,))
        await db.commit()
        return cursor.rowcount > 0
```

**Step 5: Create scanner.py**

```python
# backend/bumblebee_gui/scanner.py
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
```

**Step 6: Create main.py**

```python
# backend/bumblebee_gui/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List
import json

from .models import ScanRequest, ScanRecord, PackageRecord, FindingRecord
from .database import init_db, insert_scan, update_scan_status, get_scans, get_scan, delete_scan
from .scanner import run_scan, get_scan_packages, get_scan_findings, ScanStatus


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
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
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "version": "0.1.0"}


@app.post("/api/scans", response_model=ScanRecord)
async def create_scan(request: ScanRequest):
    """Trigger a new Bumblebee scan."""
    # Create initial record
    scan_id = await insert_scan(
        profile=request.profile,
        status=ScanStatus.running,
    )

    try:
        # Run scan
        summary, ndjson_path = await run_scan(request)

        # Update with results
        await update_scan_status(
            scan_id=scan_id,
            status=ScanStatus.completed,
            summary=summary,
        )

        # Return the scan record
        scan = await get_scan(scan_id)
        return scan

    except Exception as e:
        # Update with error status
        await update_scan_status(scan_id=scan_id, status=ScanStatus.failed)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/scans", response_model=List[ScanRecord])
async def list_scans(limit: int = 20):
    """List recent scans."""
    return await get_scans(limit)


@app.get("/api/scans/{scan_id}", response_model=ScanRecord)
async def get_scan_detail(scan_id: int):
    """Get scan details."""
    scan = await get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@app.delete("/api/scans/{scan_id}")
async def delete_scan_endpoint(scan_id: int):
    """Delete a scan."""
    scan = await get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    success = await delete_scan(scan_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete scan")

    return {"status": "deleted"}


@app.get("/api/scans/{scan_id}/packages", response_model=List[PackageRecord])
async def get_scan_packages_endpoint(scan_id: int):
    """Get packages from a scan."""
    scan = await get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    if not scan.ndjson_path:
        raise HTTPException(status_code=400, detail="No data available")

    return await get_scan_packages(scan_id, scan.ndjson_path)


@app.get("/api/scans/{scan_id}/findings", response_model=List[FindingRecord])
async def get_scan_findings_endpoint(scan_id: int):
    """Get findings from a scan."""
    scan = await get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    if not scan.ndjson_path:
        raise HTTPException(status_code=400, detail="No data available")

    return await get_scan_findings(scan_id, scan.ndjson_path)


@app.get("/api/scans/{scan_id}/export")
async def export_scan(scan_id: int, format: str = "json"):
    """Export scan data as JSON or CSV."""
    scan = await get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    if not scan.ndjson_path:
        raise HTTPException(status_code=400, detail="No data available")

    packages = await get_scan_packages(scan_id, scan.ndjson_path)

    if format == "csv":
        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Package", "Ecosystem", "Version", "Source"])
        for pkg in packages:
            writer.writerow([pkg.name, pkg.ecosystem, pkg.version, pkg.source])

        from fastapi.responses import StreamingResponse

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=scan_{scan_id}.csv"},
        )
    else:
        from fastapi.responses import JSONResponse

        data = [pkg.model_dump() for pkg in packages]
        return JSONResponse(
            content=data,
            headers={"Content-Disposition": f"attachment; filename=scan_{scan_id}.json"},
        )
```

**Step 7: Test backend starts**

Run: `docker compose up backend`
Expected: FastAPI starts on port 8000

Run: `curl http://localhost:8000/api/health`
Expected: `{"status":"ok","version":"0.1.0"}`

**Step 8: Commit**

```bash
git add backend/
git commit -m "feat: add FastAPI backend with Bumblebee CLI integration"
```

---

### Task 3: Create Frontend Project Structure

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

**Step 1: Create package.json**

```json
{
  "name": "bumblebee-gui-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "zustand": "^4.4.7",
    "recharts": "^2.10.3",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.1.0",
    "lucide-react": "^0.294.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5",
    "typescript": "^5.2.2",
    "vite": "^5.0.0"
  }
}
```

**Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 4: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bumblebee GUI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 6: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Step 7: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Step 8: Create src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 212.7 26.8% 83.9%;
}
```

**Step 9: Create src/main.tsx**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**Step 10: Create src/App.tsx**

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Scan from './pages/Scan'
import Results from './pages/Results'
import Findings from './pages/Findings'
import Settings from './pages/Settings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="scan" element={<Scan />} />
          <Route path="results/:scanId?" element={<Results />} />
          <Route path="findings/:scanId?" element={<Findings />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

**Step 11: Test frontend starts**

Run: `docker compose up frontend`
Expected: Vite dev server starts on port 5173

Open: `http://localhost:5173`
Expected: React app loads (blank page with no errors)

**Step 12: Commit**

```bash
git add frontend/
git commit -m "feat: add React frontend with Vite and TailwindCSS"
```

---

## Phase 2: Frontend Components

### Task 4: Create Layout with Sidebar

**Files:**
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/ThemeToggle.tsx`
- Create: `frontend/src/lib/utils.ts`

**Step 1: Create utils.ts**

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Step 2: Create ThemeToggle.tsx**

```typescript
import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') as 'light' | 'dark' || 
             (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    }
    return 'light'
  })

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="p-2 rounded-md hover:bg-accent"
    >
      {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  )
}
```

**Step 3: Create Sidebar.tsx**

```typescript
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Scan, 
  Table, 
  AlertTriangle, 
  Settings,
  Bug
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/scan', icon: Scan, label: 'Scan' },
  { to: '/results', icon: Table, label: 'Results' },
  { to: '/findings', icon: AlertTriangle, label: 'Findings' },
]

const bottomItems = [
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-card flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Bug className="h-6 w-6" />
          <h1 className="text-xl font-bold">Bumblebee GUI</h1>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-accent hover:text-accent-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t space-y-1">
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-accent hover:text-accent-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </aside>
  )
}
```

**Step 4: Create Layout.tsx**

```typescript
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'

export default function Layout() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b flex items-center justify-between px-6">
          <div />
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

**Step 5: Create placeholder pages**

Create `frontend/src/pages/Dashboard.tsx`:
```typescript
export default function Dashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
      <p className="text-muted-foreground">Dashboard coming soon...</p>
    </div>
  )
}
```

Create similar placeholders for Scan, Results, Findings, Settings.

**Step 6: Test layout renders**

Run: `docker compose up`
Open: `http://localhost:5173`
Expected: Sidebar visible, navigation works, theme toggle works

**Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: add layout with sidebar navigation and theme toggle"
```

---

### Task 5: Create API Client and Store

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/stores/scanStore.ts`

**Step 1: Create api.ts**

```typescript
const API_BASE = '/api'

export interface ScanRequest {
  profile: 'baseline' | 'project' | 'deep'
  ecosystems?: string[]
  roots?: string[]
  exposure_catalog?: string
  findings_only?: boolean
  max_duration?: string
}

export interface ScanSummary {
  total_packages: number
  ecosystems_found: number
  findings_count: number
  ecosystem_counts: Record<string, number>
}

export interface ScanRecord {
  id: number
  timestamp: string
  profile: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  summary?: ScanSummary
  ndjson_path?: string
}

export interface PackageRecord {
  name: string
  ecosystem: string
  version: string
  source: string
}

export interface FindingRecord {
  package: string
  version: string
  ecosystem: string
  severity: string
  cve?: string
  description: string
  found_in: string
}

export const api = {
  async health(): Promise<{ status: string; version: string }> {
    const res = await fetch(`${API_BASE}/health`)
    return res.json()
  },

  async createScan(request: ScanRequest): Promise<ScanRecord> {
    const res = await fetch(`${API_BASE}/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async listScans(limit = 20): Promise<ScanRecord[]> {
    const res = await fetch(`${API_BASE}/scans?limit=${limit}`)
    return res.json()
  },

  async getScan(id: number): Promise<ScanRecord> {
    const res = await fetch(`${API_BASE}/scans/${id}`)
    if (!res.ok) throw new Error('Scan not found')
    return res.json()
  },

  async deleteScan(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/scans/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete')
  },

  async getScanPackages(id: number): Promise<PackageRecord[]> {
    const res = await fetch(`${API_BASE}/scans/${id}/packages`)
    if (!res.ok) throw new Error('Failed to fetch packages')
    return res.json()
  },

  async getScanFindings(id: number): Promise<FindingRecord[]> {
    const res = await fetch(`${API_BASE}/scans/${id}/findings`)
    if (!res.ok) throw new Error('Failed to fetch findings')
    return res.json()
  },

  async exportScan(id: number, format: 'json' | 'csv'): Promise<Blob> {
    const res = await fetch(`${API_BASE}/scans/${id}/export?format=${format}`)
    return res.blob()
  },
}
```

**Step 2: Create scanStore.ts**

```typescript
import { create } from 'zustand'
import { api, ScanRecord, PackageRecord, FindingRecord } from '@/lib/api'

interface ScanState {
  scans: ScanRecord[]
  currentScan: ScanRecord | null
  packages: PackageRecord[]
  findings: FindingRecord[]
  loading: boolean
  error: string | null

  fetchScans: () => Promise<void>
  fetchScan: (id: number) => Promise<void>
  fetchPackages: (id: number) => Promise<void>
  fetchFindings: (id: number) => Promise<void>
  createScan: (request: any) => Promise<ScanRecord>
  deleteScan: (id: number) => Promise<void>
  clearError: () => void
}

export const useScanStore = create<ScanState>((set, get) => ({
  scans: [],
  currentScan: null,
  packages: [],
  findings: [],
  loading: false,
  error: null,

  fetchScans: async () => {
    set({ loading: true, error: null })
    try {
      const scans = await api.listScans()
      set({ scans, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  fetchScan: async (id: number) => {
    set({ loading: true, error: null })
    try {
      const scan = await api.getScan(id)
      set({ currentScan: scan, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  fetchPackages: async (id: number) => {
    set({ loading: true, error: null })
    try {
      const packages = await api.getScanPackages(id)
      set({ packages, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  fetchFindings: async (id: number) => {
    set({ loading: true, error: null })
    try {
      const findings = await api.getScanFindings(id)
      set({ findings, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  createScan: async (request) => {
    set({ loading: true, error: null })
    try {
      const scan = await api.createScan(request)
      set({ loading: false })
      get().fetchScans()
      return scan
    } catch (err: any) {
      set({ error: err.message, loading: false })
      throw err
    }
  },

  deleteScan: async (id: number) => {
    set({ loading: true, error: null })
    try {
      await api.deleteScan(id)
      set({ loading: false })
      get().fetchScans()
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
```

**Step 3: Commit**

```bash
git add frontend/src/lib/ frontend/src/stores/
git commit -m "feat: add API client and Zustand store"
```

---

### Task 6: Implement Dashboard Page

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`
- Create: `frontend/src/components/StatsCard.tsx`
- Create: `frontend/src/components/EcosystemChart.tsx`

**Step 1: Create StatsCard.tsx**

```typescript
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ReactNode
  className?: string
}

export function StatsCard({ title, value, description, icon, className }: StatsCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <div className="text-muted-foreground">{icon}</div>
      </div>
    </div>
  )
}
```

**Step 2: Create EcosystemChart.tsx**

```typescript
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface EcosystemChartProps {
  data: Record<string, number>
}

export function EcosystemChart({ data }: EcosystemChartProps) {
  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="hsl(var(--primary))" />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

**Step 3: Implement Dashboard.tsx**

```typescript
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Layers, AlertTriangle, Clock } from 'lucide-react'
import { useScanStore } from '@/stores/scanStore'
import { StatsCard } from '@/components/StatsCard'
import { EcosystemChart } from '@/components/EcosystemChart'
import { Button } from '@/components/ui/button'

export default function Dashboard() {
  const navigate = useNavigate()
  const { scans, fetchScans, loading } = useScanStore()

  useEffect(() => {
    fetchScans()
  }, [fetchScans])

  const lastScan = scans[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <Button onClick={() => navigate('/scan')}>Scan Now</Button>
      </div>

      {scans.length === 0 ? (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No scans yet</h3>
          <p className="text-muted-foreground mb-4">
            Run your first scan to see package inventory
          </p>
          <Button onClick={() => navigate('/scan')}>Run First Scan</Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatsCard
              title="Total Packages"
              value={lastScan?.summary?.total_packages ?? 0}
              icon={<Package className="h-6 w-6" />}
            />
            <StatsCard
              title="Ecosystems"
              value={lastScan?.summary?.ecosystems_found ?? 0}
              icon={<Layers className="h-6 w-6" />}
            />
            {lastScan?.summary?.findings_count > 0 && (
              <StatsCard
                title="Findings"
                value={lastScan.summary.findings_count}
                description="Exposure matches"
                icon={<AlertTriangle className="h-6 w-6" />}
                className="border-destructive"
              />
            )}
          </div>

          {lastScan?.summary?.ecosystem_counts && (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">Packages by Ecosystem</h3>
              <EcosystemChart data={lastScan.summary.ecosystem_counts} />
            </div>
          )}

          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Scans</h3>
            <div className="space-y-2">
              {scans.slice(0, 5).map((scan) => (
                <div
                  key={scan.id}
                  className="flex items-center justify-between p-3 rounded-md hover:bg-accent cursor-pointer"
                  onClick={() => navigate(`/results/${scan.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{scan.profile}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(scan.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {scan.summary?.total_packages ?? 0} packages
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

**Step 4: Create Button component**

Create `frontend/src/components/ui/button.tsx`:
```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

**Step 5: Test Dashboard**

Run: `docker compose up`
Open: `http://localhost:5173`
Expected: Dashboard loads, shows empty state, "Scan Now" button works

**Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: implement Dashboard page with stats and charts"
```

---

### Task 7: Implement Scan Page

**Files:**
- Modify: `frontend/src/pages/Scan.tsx`
- Create: `frontend/src/components/ScanForm.tsx`

**Step 1: Create ScanForm.tsx**

(Detailed scan form with progressive disclosure — profile selector, ecosystem checkboxes, root directory input, exposure catalog upload)

**Step 2: Implement Scan.tsx**

(Page that uses ScanForm, handles scan submission, shows progress)

**Step 3: Test scan execution**

Run a baseline scan, verify it completes and redirects to results

**Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: implement Scan page with configuration form"
```

---

### Task 8: Implement Results Page

**Files:**
- Modify: `frontend/src/pages/Results.tsx`
- Create: `frontend/src/components/PackageTable.tsx`
- Create: `frontend/src/components/ExportButtons.tsx`

**Step 1: Create PackageTable.tsx**

(Filterable, searchable, sortable table)

**Step 2: Create ExportButtons.tsx**

(JSON/CSV export buttons)

**Step 3: Implement Results.tsx**

(Page with filters, table, summary chart, export)

**Step 4: Test results display**

Run scan, view results, test filters and export

**Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: implement Results page with table and export"
```

---

### Task 9: Implement Findings Page

**Files:**
- Modify: `frontend/src/pages/Findings.tsx`
- Create: `frontend/src/components/FindingCard.tsx`

**Step 1: Create FindingCard.tsx**

(Card showing severity, CVE, description)

**Step 2: Implement Findings.tsx**

(Page with severity filters, findings list, empty states)

**Step 3: Commit**

```bash
git add frontend/src/
git commit -m "feat: implement Findings page with severity display"
```

---

### Task 10: Implement Settings Page

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

**Step 1: Implement Settings.tsx**

(Theme toggle, presets management, data management, update checks)

**Step 2: Commit**

```bash
git add frontend/src/
git commit -m "feat: implement Settings page"
```

---

## Phase 3: Testing & Polish

### Task 11: End-to-End Testing

**Step 1: Test full workflow**

1. Start fresh: `docker compose down -v && docker compose up`
2. Open Dashboard → see empty state
3. Navigate to Scan → configure baseline scan
4. Execute scan → wait for completion
5. View Results → verify packages displayed
6. Test filters and search
7. Export as JSON and CSV
8. Navigate to Dashboard → see stats updated
9. Test theme toggle (light/dark)
10. Test Settings page

**Step 2: Fix any issues found**

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: address issues from end-to-end testing"
```

---

### Task 12: Create Install Script

**Files:**
- Create: `install.sh`
- Create: `README.md` (update with install instructions)

**Step 1: Create install.sh**

```bash
#!/bin/bash
set -e

echo "🐝 Installing Bumblebee GUI..."

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
    darwin)
        case "$ARCH" in
            arm64) PLATFORM="darwin_arm64" ;;
            x86_64) PLATFORM="darwin_amd64" ;;
            *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
        esac
        ;;
    linux)
        case "$ARCH" in
            x86_64) PLATFORM="linux_amd64" ;;
            aarch64) PLATFORM="linux_arm64" ;;
            *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
        esac
        ;;
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

echo "Detected platform: $PLATFORM"

# Create installation directory
INSTALL_DIR="$HOME/.bumblebee-gui"
mkdir -p "$INSTALL_DIR/bin"

# Download Bumblebee binary
BUMBLEBEE_VERSION="0.1.1"
BUMBLEBEE_URL="https://github.com/perplexityai/bumblebee/releases/download/v${BUMBLEBEE_VERSION}/bumblebee_${BUMBLEBEE_VERSION}_${PLATFORM}.tar.gz"

echo "Downloading Bumblebee v${BUMBLEBEE_VERSION}..."
curl -L "$BUMBLEBEE_URL" | tar -xz -C "$INSTALL_DIR/bin/"

# Download Bumblebee GUI
GUI_VERSION="0.1.0"
GUI_URL="https://github.com/user/bumblebee-gui/releases/download/v${GUI_VERSION}/bumblebee-gui_${GUI_VERSION}_${PLATFORM}.tar.gz"

echo "Downloading Bumblebee GUI v${GUI_VERSION}..."
curl -L "$GUI_URL" | tar -xz -C "$INSTALL_DIR/"

# Create launcher script
cat > "$INSTALL_DIR/bin/bumblebee-gui" << 'EOF'
#!/bin/bash
cd "$HOME/.bumblebee-gui"
python3 -m bumblebee_gui "$@"
EOF
chmod +x "$INSTALL_DIR/bin/bumblebee-gui"

# Add to PATH if not already there
SHELL_RC="$HOME/.bashrc"
[ -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.zshrc"

if ! grep -q ".bumblebee-gui/bin" "$SHELL_RC"; then
    echo 'export PATH="$HOME/.bumblebee-gui/bin:$PATH"' >> "$SHELL_RC"
    echo "Added to PATH in $SHELL_RC"
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "To start Bumblebee GUI:"
echo "  source $SHELL_RC"
echo "  bumblebee-gui"
echo ""
echo "Or run directly:"
echo "  $INSTALL_DIR/bin/bumblebee-gui"
```

**Step 2: Test install script locally**

**Step 3: Commit**

```bash
git add install.sh
git commit -m "feat: add installation script"
```

---

## Phase 4: Release

### Task 13: Create GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/release.yml`

**Step 1: Create release workflow**

(Builds frontend, packages backend, creates release with install script)

**Step 2: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions release workflow"
```

---

### Task 14: Final Testing & Release

**Step 1: Tag release**

```bash
git tag v0.1.0
git push origin v0.1.0
```

**Step 2: Verify GitHub Actions builds**

**Step 3: Test install script from GitHub**

**Step 4: Create release notes**

---

## Plan Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| Phase 1 | 1-3 | Docker + Backend + Frontend setup |
| Phase 2 | 4-10 | UI components and pages |
| Phase 3 | 11-12 | Testing and install script |
| Phase 4 | 13-14 | CI/CD and release |

**Total tasks:** 14
**Estimated time:** 2-4 hours for experienced developer

---

**Plan created:** 2026-05-27
**Next:** Execute with executing-plans skill
