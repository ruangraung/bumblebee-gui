import aiosqlite
import json
import os
from pathlib import Path
from datetime import datetime, timezone
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
                ndjson_path TEXT,
                timed_out INTEGER,
                duration_ms INTEGER,
                files_considered INTEGER
            )
        """)
        await _add_missing_columns(db)
        await db.commit()


async def _add_missing_columns(db) -> None:
    """Add coverage columns to a database created before they existed."""
    cursor = await db.execute("PRAGMA table_info(scans)")
    existing = {row[1] for row in await cursor.fetchall()}
    for column in ("timed_out", "duration_ms", "files_considered"):
        if column not in existing:
            await db.execute(f"ALTER TABLE scans ADD COLUMN {column} INTEGER")


def _summary_from_row(row) -> Optional[ScanSummary]:
    """Rebuild a scan's summary from its row, None while the scan is unfinished."""
    if row["total_packages"] is None:
        return None
    return ScanSummary(
        total_packages=row["total_packages"] or 0,
        ecosystems_found=row["ecosystems_found"] or 0,
        findings_count=row["findings_count"] or 0,
        ecosystem_counts=json.loads(row["ecosystem_counts"]) if row["ecosystem_counts"] else {},
        timed_out=bool(row["timed_out"]),
        duration_ms=row["duration_ms"],
        files_considered=row["files_considered"],
    )


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
                             ecosystems_found, findings_count, ecosystem_counts, ndjson_path,
                             timed_out, duration_ms, files_considered)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                datetime.now(timezone.utc).isoformat(),
                profile.value,
                status.value,
                summary.total_packages if summary else None,
                summary.ecosystems_found if summary else None,
                summary.findings_count if summary else None,
                json.dumps(summary.ecosystem_counts) if summary else None,
                ndjson_path,
                int(summary.timed_out) if summary else None,
                summary.duration_ms if summary else None,
                summary.files_considered if summary else None,
            ),
        )
        await db.commit()
        return cursor.lastrowid


async def update_scan_status(
    scan_id: int,
    status: ScanStatus,
    summary: Optional[ScanSummary] = None,
    ndjson_path: Optional[str] = None,
):
    """Update scan status, optionally summary and ndjson_path."""
    async with aiosqlite.connect(DB_PATH) as db:
        if summary:
            await db.execute(
                """
                UPDATE scans 
                SET status = ?, total_packages = ?, ecosystems_found = ?,
                    findings_count = ?, ecosystem_counts = ?,
                    timed_out = ?, duration_ms = ?, files_considered = ?,
                    ndjson_path = COALESCE(?, ndjson_path)
                WHERE id = ?
                """,
                (
                    status.value,
                    summary.total_packages,
                    summary.ecosystems_found,
                    summary.findings_count,
                    json.dumps(summary.ecosystem_counts),
                    int(summary.timed_out),
                    summary.duration_ms,
                    summary.files_considered,
                    ndjson_path,
                    scan_id,
                ),
            )
        else:
            await db.execute(
                "UPDATE scans SET status = ?, ndjson_path = COALESCE(?, ndjson_path) WHERE id = ?",
                (status.value, ndjson_path, scan_id),
            )
        await db.commit()


async def get_scans(limit: int = 20) -> List[ScanRecord]:
    """Get recent scans."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM scans ORDER BY timestamp DESC, id DESC LIMIT ?", (limit,)
        )
        rows = await cursor.fetchall()
        return [
            ScanRecord(
                id=row["id"],
                timestamp=datetime.fromisoformat(row["timestamp"]),
                profile=ScanProfile(row["profile"]),
                status=ScanStatus(row["status"]),
                summary=_summary_from_row(row),
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
            summary=_summary_from_row(row),
            ndjson_path=row["ndjson_path"],
        )


async def delete_scan(scan_id: int) -> bool:
    """Delete a scan record."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("DELETE FROM scans WHERE id = ?", (scan_id,))
        await db.commit()
        return cursor.rowcount > 0


async def fail_stale_running_scans():
    """Mark scans stuck in 'running' as failed.

    A backend restart mid-scan orphans the background task (the task registry
    lives in memory only), which would otherwise leave rows permanently
    'running'. Runs on startup, before the API serves requests.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE scans SET status = ? WHERE status = ?",
            (ScanStatus.failed.value, ScanStatus.running.value),
        )
        await db.commit()
