import aiosqlite
import json
import os
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional

from .models import ScanReceipt, ScanRecord, ScanProfile, ScanStatus, ScanSummary

DB_DIR = Path(os.environ.get("BUMBLEBEE_DATA_DIR", Path.home() / ".bumblebee-gui"))
DB_PATH = DB_DIR / "bumblebee-gui.db"

# Set on scans a backend restart orphaned: the reason is known, so it is recorded
# rather than leaving a failed scan with nothing to say.
RESTART_REASON = "The backend restarted while this scan was running."


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
                files_considered INTEGER,
                error TEXT
            )
        """)
        await _add_missing_columns(db)
        await db.commit()


async def _add_missing_columns(db) -> None:
    """Add columns to a database created before they existed."""
    cursor = await db.execute("PRAGMA table_info(scans)")
    existing = {row[1] for row in await cursor.fetchall()}
    for column, kind in (
        ("timed_out", "INTEGER"),
        ("duration_ms", "INTEGER"),
        ("files_considered", "INTEGER"),
        ("error", "TEXT"),
        ("receipt", "TEXT"),
    ):
        if column not in existing:
            await db.execute(f"ALTER TABLE scans ADD COLUMN {column} {kind}")


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


def _receipt_from_row(row) -> Optional[ScanReceipt]:
    """Rebuild a receipt, None when the scan predates receipts.

    A row written before this column existed has nothing to rebuild from, and a
    receipt invented now would describe today's catalogues rather than what that
    scan actually compared against. Unreadable JSON is treated the same way: the
    record says unknown instead of guessing.
    """
    raw = row["receipt"]
    if not raw:
        return None
    try:
        return ScanReceipt.model_validate_json(raw)
    except ValueError:
        return None


def _record_from_row(row) -> ScanRecord:
    """Map a scans row onto its API model.

    One place to map a column, so a field added to the table cannot reach one
    reader of a scan and miss another.
    """
    return ScanRecord(
        id=row["id"],
        timestamp=datetime.fromisoformat(row["timestamp"]),
        profile=ScanProfile(row["profile"]),
        status=ScanStatus(row["status"]),
        summary=_summary_from_row(row),
        ndjson_path=row["ndjson_path"],
        error=row["error"],
        receipt=_receipt_from_row(row),
    )


async def insert_scan(
    profile: ScanProfile,
    status: ScanStatus,
    ndjson_path: Optional[str] = None,
    receipt: Optional[ScanReceipt] = None,
) -> int:
    """Insert a new scan record and return its ID.

    Only the facts known when a scan starts. A summary arrives later through
    update_scan_status, so this stays the single writer for each kind of fact
    instead of offering a second way to write a summary from here.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            INSERT INTO scans (timestamp, profile, status, ndjson_path, receipt)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                datetime.now(timezone.utc).isoformat(),
                profile.value,
                status.value,
                ndjson_path,
                receipt.model_dump_json() if receipt else None,
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


async def record_scan_failure(scan_id: int, reason: str) -> None:
    """Mark a scan failed and record why, so the record can explain itself."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE scans SET status = ?, error = ? WHERE id = ?",
            (ScanStatus.failed.value, reason, scan_id),
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
        return [_record_from_row(row) for row in rows]


async def get_scan_history(limit: int = 20, offset: int = 0) -> tuple[List[ScanRecord], int]:
    """Read a page and its total from the same database snapshot."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("BEGIN")
        cursor = await db.execute("SELECT COUNT(*) FROM scans")
        total = (await cursor.fetchone())[0]
        cursor = await db.execute(
            "SELECT * FROM scans ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?",
            (limit, offset),
        )
        rows = await cursor.fetchall()
        return [_record_from_row(row) for row in rows], total


async def get_scan(scan_id: int) -> Optional[ScanRecord]:
    """Get a specific scan by ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM scans WHERE id = ?", (scan_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        return _record_from_row(row)


async def get_scan_ids() -> list[int]:
    """Capture deletion scope without depending on a recent-list limit."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT id FROM scans ORDER BY id")
        return [row[0] for row in await cursor.fetchall()]


async def delete_scan(scan_id: int) -> bool:
    """Delete a scan record."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("DELETE FROM scans WHERE id = ?", (scan_id,))
        await db.commit()
        return cursor.rowcount > 0


async def fail_stale_running_scans():
    """Mark scans stuck in 'running' as failed, and say why.

    A backend restart mid-scan orphans the background task (the task registry
    lives in memory only), which would otherwise leave rows permanently
    'running'. Runs on startup, before the API serves requests.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE scans SET status = ?, error = COALESCE(error, ?) WHERE status = ?",
            (ScanStatus.failed.value, RESTART_REASON, ScanStatus.running.value),
        )
        await db.commit()
