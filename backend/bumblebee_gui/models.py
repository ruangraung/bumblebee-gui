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
    max_duration: Optional[str] = ""


class ScanSummary(BaseModel):
    total_packages: int
    ecosystems_found: int
    findings_count: int
    ecosystem_counts: dict[str, int]
    # Coverage of the walk itself, from the CLI's scan_summary record. A scan
    # that hit its time limit reports fewer files than a full one, which is the
    # only signal that the results are partial.
    timed_out: bool = False
    duration_ms: Optional[int] = None
    files_considered: Optional[int] = None


class HostMountReport(BaseModel):
    """What the host mount offers, for the scan form to show."""

    mounted: bool
    path: str
    parent: Optional[str] = None
    directories: List[str] = []
    file_count: int = 0


class CatalogueSummary(BaseModel):
    """The catalogues behind a scan: what it compared packages against."""

    catalogues: int
    entries: int
    versions: int
    available: bool


class ScannerInfo(BaseModel):
    """What the scanner binary reports about itself, for the About panel.

    Version and commit are None when the binary is missing, silent, or printing
    something unrecognised; ``error`` then says what happened, so the panel can
    state the gap instead of showing a version that is not real.
    """

    version: Optional[str] = None
    commit: Optional[str] = None
    error: Optional[str] = None


class CatalogueReceipt(BaseModel):
    """Which catalogue a scan compared against, and what was in it.

    ``mode`` is what the request asked for: ``bundled`` when it named nothing and
    this install ships catalogues, ``custom`` when it named a path, ``disabled``
    when it asked for none. A ``bundled`` mode with no ``path`` means the request
    wanted the bundled set and none was installed, which is a different fact from
    asking for no comparison at all.
    """

    mode: str
    path: Optional[str] = None
    catalogues: int = 0
    entries: int = 0
    versions: int = 0
    # sha256 of every catalogue file that was actually present, so a later rebuild
    # cannot silently change what an old result claims to have compared against.
    digests: dict[str, str] = {}


class ScanReceipt(BaseModel):
    """What a scan actually ran with, recorded when it started.

    The scans row carries the profile, status and summary but not the request or
    the identity of the catalogue, so a historical or custom-catalogue scan used
    to display the bundled-catalogue comparison, and rebuilding with new
    catalogues changed the denominator under an old result. This is the snapshot
    taken at execution, and it is never reconstructed from the current image.
    """

    recorded_at: datetime
    profile: ScanProfile
    requested_roots: List[str] = []
    # Absolute forms of the requested roots. Empty when the request named none,
    # in which case the profile decides the roots and this receipt says so by
    # saying nothing.
    resolved_roots: List[str] = []
    ecosystems: List[str] = []
    findings_only: bool = False
    max_duration: Optional[str] = None
    scanner_version: Optional[str] = None
    scanner_commit: Optional[str] = None
    catalogue: CatalogueReceipt
    # Whether packages were actually compared against anything. An inventory-only
    # scan must not read as though exposure comparison happened.
    exposure_comparison: bool = False


class ScanRecord(BaseModel):
    id: int
    timestamp: datetime
    profile: ScanProfile
    status: ScanStatus
    summary: Optional[ScanSummary] = None
    ndjson_path: Optional[str] = None
    # Why a failed scan failed, in the scanner's own words. Without it a failed
    # scan and a scan that matched nothing look the same on screen.
    error: Optional[str] = None
    # Live progress: packages discovered so far while running; final total when
    # completed. Computed on read — not stored in the database.
    packages_found: Optional[int] = None
    # What this scan ran with. None on records written before receipts existed,
    # which reads as unknown provenance rather than as the current image.
    receipt: Optional[ScanReceipt] = None


class ScanHistoryPage(BaseModel):
    scans: List[ScanRecord]
    total: int
    offset: int
    limit: int


class ScanDeletionFailure(BaseModel):
    id: int
    detail: str


class HistoryDeletionResult(BaseModel):
    deleted_ids: List[int]
    failures: List[ScanDeletionFailure]
    remaining: int


class PackageRecord(BaseModel):
    package_name: str
    ecosystem: str
    version: str
    source_type: Optional[str] = None
    source_file: Optional[str] = None
    project_path: Optional[str] = None
    package_manager: Optional[str] = None
    confidence: Optional[str] = None
    has_lifecycle_scripts: Optional[bool] = None


class FindingRecord(BaseModel):
    package_name: str
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
