"""Render scan exports for the API layer.

The export endpoint stays thin: it resolves the scan, loads the records and
delegates the byte shaping here, so the JSON payload keys and the CSV section
layout live in exactly one place.
"""

import csv
import io
import json
from dataclasses import dataclass
from typing import Callable

from fastapi.responses import StreamingResponse

from .models import FindingRecord, PackageRecord, ScanRecord


@dataclass(frozen=True)
class ExportPayload:
    """Everything one export renders: the scan plus the records it produced."""

    scan: ScanRecord
    packages: list[PackageRecord]
    findings: list[FindingRecord]


def render_json_export(payload: ExportPayload) -> str:
    """Render the JSON export: the scan record plus both record lists."""
    data = {
        "scan": payload.scan.model_dump(mode="json"),
        "packages": [p.model_dump() for p in payload.packages],
        "findings": [f.model_dump() for f in payload.findings],
    }
    return json.dumps(data, indent=2)


def write_csv_section(output: io.StringIO, heading: str, records: list) -> None:
    """Write one titled CSV section: heading, then a header row and records.

    An empty record list leaves just the heading, matching the export layout
    clients already parse.
    """
    output.write(heading)
    if not records:
        return
    writer = csv.DictWriter(output, fieldnames=records[0].model_dump().keys())
    writer.writeheader()
    for record in records:
        writer.writerow(record.model_dump())


def render_csv_export(payload: ExportPayload) -> str:
    """Render the CSV export as a packages section followed by findings."""
    output = io.StringIO()
    write_csv_section(output, "=== PACKAGES ===\n", payload.packages)
    write_csv_section(output, "\n=== FINDINGS ===\n", payload.findings)
    return output.getvalue()


@dataclass(frozen=True)
class ExportFormat:
    """One export flavour: how to render it and how to describe it to clients."""

    render: Callable[[ExportPayload], str]
    media_type: str
    extension: str


EXPORT_FORMATS: dict[str, ExportFormat] = {
    "json": ExportFormat(render_json_export, "application/json", "json"),
    "csv": ExportFormat(render_csv_export, "text/csv", "csv"),
}


def build_export_response(
    scan_id: int,
    payload: ExportPayload,
    export_format: ExportFormat,
) -> StreamingResponse:
    """Wrap rendered export content in a downloadable streaming response."""
    content = export_format.render(payload)
    filename = f"scan_{scan_id}.{export_format.extension}"
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type=export_format.media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
