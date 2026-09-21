"""What the scanner compares packages against.

A scan reports nothing unless the scanner has catalogues to compare against, so
these counts are the denominator behind a scan that found no matches. Eleven
catalogues examined and nothing matched is a result; a scan with no catalogues
examined and nothing matched is not.
"""

import json
from pathlib import Path
from typing import Any


def _versions_in(entry: Any) -> int:
    if not isinstance(entry, dict):
        return 0
    versions = entry.get("versions")
    return len(versions) if isinstance(versions, list) else 0


def catalogue_summary(directory: Path) -> dict:
    """Count the catalogues in `directory`.

    A file that cannot be read or parsed is skipped rather than raised on: this
    count is rendered beside a scan result, and a malformed catalogue is a
    packaging problem, not a reason to fail the page.
    """
    files = sorted(directory.glob("*.json")) if directory.is_dir() else []
    catalogues = 0
    entries = 0
    versions = 0

    for path in files:
        try:
            document = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
        listed = document.get("entries") if isinstance(document, dict) else None
        if not isinstance(listed, list):
            continue
        catalogues += 1
        entries += len(listed)
        versions += sum(_versions_in(entry) for entry in listed)

    return {
        "catalogues": catalogues,
        "entries": entries,
        "versions": versions,
        "available": catalogues > 0,
    }
