"""CSV export cell safety.

Both export paths must treat a spreadsheet formula the same way: a package name
arriving from scan input is attacker-controlled, so a leading `=`, `+`, `-`, `@`,
tab or carriage return must be neutralised with the spreadsheet's own text marker.
The browser export already does this; these tests pin the backend to the same
policy, including the npm-scope case that must NOT be neutralised.
"""

import csv
import io
from datetime import datetime, timezone

import pytest

from bumblebee_gui.exporters import ExportPayload, render_csv_export
from bumblebee_gui.models import (
    FindingRecord,
    PackageRecord,
    ScanProfile,
    ScanRecord,
    ScanStatus,
)

# Shapes a spreadsheet interprets as a formula or as a row-shifting prefix.
HOSTILE_CELLS = [
    "=cmd|'/c calc'!A1",
    "+1+1",
    "-1+1",
    "@SUM(1+1)",
    "\tINDIRECT(\"x\")",
    "\rHYPERLINK(\"x\")",
]


def build_payload(packages, findings=None) -> ExportPayload:
    scan = ScanRecord(
        id=1,
        timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc),
        profile=ScanProfile.baseline,
        status=ScanStatus.completed,
    )
    return ExportPayload(scan=scan, packages=packages, findings=findings or [])


def package(name: str) -> PackageRecord:
    return PackageRecord(package_name=name, ecosystem="npm", version="1.0.0")


def finding(name: str) -> FindingRecord:
    return FindingRecord(
        package_name=name,
        version="1.0.0",
        ecosystem="npm",
        severity="high",
        catalog_id="TEST",
        catalog_name="test catalog",
        evidence="fixture",
    )


def data_rows(rendered: str, width: int) -> list:
    """Parsed rows of a given width, skipping headings and header rows."""
    rows = [
        row
        for row in csv.reader(io.StringIO(rendered))
        if len(row) == width and row[0] != "package_name"
    ]
    return rows


@pytest.mark.parametrize("cell", HOSTILE_CELLS)
def test_package_cell_is_neutralised(cell):
    rendered = render_csv_export(build_payload([package(cell)]))

    rows = data_rows(rendered, width=9)

    assert len(rows) == 1
    assert rows[0][0] == f"'{cell}"


@pytest.mark.parametrize("cell", HOSTILE_CELLS)
def test_finding_cell_is_neutralised(cell):
    rendered = render_csv_export(build_payload([], [finding(cell)]))

    rows = data_rows(rendered, width=12)

    assert len(rows) == 1
    assert rows[0][0] == f"'{cell}"


def test_every_record_field_is_neutralised():
    """The policy is per cell, not per package_name column."""
    record = FindingRecord(
        package_name="left-pad",
        version="1.0.0",
        ecosystem="npm",
        severity="high",
        catalog_id="TEST",
        catalog_name="test catalog",
        evidence="=1+1",
    )

    rendered = render_csv_export(build_payload([], [record]))
    rows = data_rows(rendered, width=12)

    assert rows[0][0] == "left-pad"
    assert rows[0][6] == "'=1+1"


def test_npm_scope_is_left_alone():
    """`@types/node` is a name, not a call, so it must survive unchanged."""
    rendered = render_csv_export(build_payload([package("@types/node")]))

    rows = data_rows(rendered, width=9)

    assert rows[0][0] == "@types/node"


def test_ordinary_names_are_unchanged():
    rendered = render_csv_export(build_payload([package("left-pad"), package("lodash")]))

    rows = data_rows(rendered, width=9)

    assert [row[0] for row in rows] == ["left-pad", "lodash"]
