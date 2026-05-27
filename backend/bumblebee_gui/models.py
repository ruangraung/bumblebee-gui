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
