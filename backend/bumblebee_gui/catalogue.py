"""What the scanner compares packages against.

A scan reports nothing unless the scanner has catalogues to compare against, so
these counts are the denominator behind a scan that found no matches. Eleven
catalogues examined and nothing matched is a result; a scan with no catalogues
examined and nothing matched is not.
"""

import json
from pathlib import Path
from typing import Any

# A catalogue is one JSON document of package entries; the bundled set ships a
# few megabytes total. A path far larger than that is not a catalogue, and
# reading it whole would stall the request that named it.
MAX_CATALOGUE_BYTES = 64 * 1024 * 1024


def problem_for_catalogue(value: str | None) -> str | None:
    """What rules a requested catalogue path out, or None when it is usable.

    Custom catalogues are a feature, so the path is not confined to the
    bundled directory; it only has to be a real absolute path, small enough
    that reading it cannot stall the scan request.
    """
    if not value:
        return None
    path = Path(value)
    if not path.is_absolute():
        return (
            f"Catalogue path {value} is relative, but the scanner runs inside the "
            "container. Give an absolute path, such as /opt/bumblebee/threat-intel."
        )
    try:
        if path.is_dir():
            size = sum(entry.stat().st_size for entry in path.glob("*.json"))
        elif path.is_file():
            size = path.stat().st_size
        else:
            return (
                f"Catalogue path {value} does not exist inside the container. "
                "A scan with no catalogues to compare against reports no matches."
            )
    except OSError as error:
        return f"Catalogue path {value} could not be read: {error}."
    if size > MAX_CATALOGUE_BYTES:
        return (
            f"Catalogue {value} is {size:,} bytes, over the "
            f"{MAX_CATALOGUE_BYTES:,} byte limit. Shrink it or point at a directory."
        )
    return None


def _versions_in(entry: Any) -> int:
    if not isinstance(entry, dict):
        return 0
    versions = entry.get("versions")
    return len(versions) if isinstance(versions, list) else 0


def catalogue_counts(files: list[Path]) -> dict:
    """Count the catalogues among these specific files.

    Counts over an explicit file list so a single custom catalogue file gets the
    same treatment as a bundled directory, instead of a second implementation
    drifting from this one.
    """
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


def catalogue_summary(directory: Path) -> dict:
    """Count the catalogues in `directory`.

    A file that cannot be read or parsed is skipped rather than raised on: this
    count is rendered beside a scan result, and a malformed catalogue is a
    packaging problem, not a reason to fail the page.
    """
    files = sorted(directory.glob("*.json")) if directory.is_dir() else []
    return catalogue_counts(files)
