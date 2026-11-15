"""What a scan ran with, captured at execution.

The scans row records the profile, the status and the summary but nothing about
the request or the identity of the catalogue. Two consequences followed. A scan
run against a custom catalogue, or a scan old enough to predate a rebuild, was
displayed beside the catalogue counts of the **current** image, so the comparison
it described was not the comparison it performed. And rebuilding changed the
denominator under an old result without saying so.

This module builds the snapshot taken when the scan starts. Nothing here reads
the database or the API layer: it takes a request and what the install has on
disk, and returns facts.
"""

import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .catalogue import catalogue_counts, catalogue_summary
from .duration import normalise_duration
from .models import CatalogueReceipt, ScanReceipt, ScanRequest, ScannerInfo
from .scanner import exposure_catalog

BUNDLED = "bundled"
CUSTOM = "custom"
DISABLED = "disabled"


def catalogue_receipt(request: ScanRequest, resolved: Optional[str]) -> CatalogueReceipt:
    """Which catalogue this scan resolved to, and what it contained.

    The three modes are distinct facts. ``custom`` means the request named a
    path. ``disabled`` means it asked for no comparison. ``bundled`` means it
    named nothing, whether or not this install actually ships catalogues; a
    bundled receipt with no path and no digests is the honest record of a request
    that wanted the bundled set and found none.
    """
    mode = _catalogue_mode(request)
    if resolved is None:
        return CatalogueReceipt(mode=mode)

    path = Path(resolved)
    counts = _counts_for(path)
    return CatalogueReceipt(
        mode=mode,
        path=str(path),
        catalogues=counts["catalogues"],
        entries=counts["entries"],
        versions=counts["versions"],
        digests=_digests_for(path),
    )


def build_receipt(request: ScanRequest, scanner: ScannerInfo) -> ScanReceipt:
    """The receipt for a scan about to start.

    ``resolved_roots`` holds the absolute form of each requested root and is
    empty when the request named none, because the profile then chooses the roots
    and this receipt must not pretend to know which.
    """
    resolved_catalogue = exposure_catalog(request)
    catalogue = catalogue_receipt(request, resolved_catalogue)
    requested_roots = list(request.roots or [])

    return ScanReceipt(
        recorded_at=datetime.now(timezone.utc),
        profile=request.profile,
        requested_roots=requested_roots,
        resolved_roots=[str(Path(root).expanduser().resolve()) for root in requested_roots],
        ecosystems=list(request.ecosystems or []),
        findings_only=request.findings_only,
        # The text the scanner actually receives, not the text the request
        # carried: a padded duration is stripped before it reaches the command.
        max_duration=normalise_duration(request.max_duration),
        scanner_version=scanner.version,
        scanner_commit=scanner.commit,
        catalogue=catalogue,
        exposure_comparison=catalogue.mode != DISABLED and catalogue.entries > 0,
    )


def _catalogue_mode(request: ScanRequest) -> str:
    """What the request asked for, before looking at what exists."""
    if request.exposure_catalog is None:
        return BUNDLED
    if not request.exposure_catalog:
        return DISABLED
    return CUSTOM


def _counts_for(path: Path) -> dict:
    """Count catalogues at a path that may be a directory or a single file."""
    empty = {"catalogues": 0, "entries": 0, "versions": 0}
    if path.is_dir():
        return catalogue_summary(path)
    if path.is_file():
        return catalogue_counts([path])
    return empty


def _digests_for(path: Path) -> dict[str, str]:
    """sha256 of every catalogue file this scan could read.

    Unreadable files are skipped, matching the counting rule: a malformed
    catalogue is a packaging problem, not a reason to refuse a scan record.
    """
    if path.is_dir():
        files = sorted(path.glob("*.json"))
    elif path.is_file():
        files = [path]
    else:
        return {}

    digests: dict[str, str] = {}
    for file in files:
        try:
            digests[file.name] = hashlib.sha256(file.read_bytes()).hexdigest()
        except OSError:
            continue
    return digests
