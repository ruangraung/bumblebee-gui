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
