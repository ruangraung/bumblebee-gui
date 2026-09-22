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
