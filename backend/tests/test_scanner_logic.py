"""Tests for the NDJSON decode boundary in scanner_logic.py.

A scan log is written by an external CLI, so any line can carry a JSON value
that is not an object. These cover the narrowing that keeps such a value out of
the record path, where every consumer expects a mapping.
"""

import json

from bumblebee_gui import scanner, scanner_logic

# ── decode_records ───────────────────────────────────────────────────────────


def test_decode_records_keeps_objects_and_skips_blank_and_malformed_lines():
    lines = [
        '{"record_type": "package", "name": "left-pad"}',
        "",
        "   ",
        "{not json",
        '{"record_type": "finding"}',
    ]
    assert list(scanner_logic.decode_records(lines)) == [
        {"record_type": "package", "name": "left-pad"},
        {"record_type": "finding"},
    ]


def test_decode_records_skips_json_values_that_are_not_objects():
    lines = ["123", '"a string"', "[1, 2]", "true", "null", '{"record_type": "package"}']

    records = list(scanner_logic.decode_records(lines))

    assert records == [{"record_type": "package"}]


def test_decode_ndjson_skips_non_object_values():
    text = "\n".join(["42", '{"record_type": "package"}', "[]"])

    assert list(scanner_logic.decode_ndjson(text)) == [{"record_type": "package"}]


# ── decode_line ──────────────────────────────────────────────────────────────


def test_decode_line_answers_none_when_the_value_is_not_an_object():
    assert scanner_logic.decode_line(b"123") is None
    assert scanner_logic.decode_line(b'"text"') is None
    assert scanner_logic.decode_line(b"[1]") is None
    assert scanner_logic.decode_line(b"null") is None


def test_decode_line_answers_none_for_malformed_json():
    assert scanner_logic.decode_line(b"{not json") is None


def test_decode_line_returns_the_object():
    assert scanner_logic.decode_line(b'{"record_type": "package"}') == {
        "record_type": "package"
    }


# ── callers ──────────────────────────────────────────────────────────────────


def test_count_packages_ignores_a_non_object_line(tmp_path):
    path = tmp_path / "scan.ndjson"
    path.write_text(
        "\n".join(
            [
                "7",
                json.dumps({"record_type": "package", "name": "left-pad"}),
                "[1, 2]",
                json.dumps({"record_type": "package", "name": "is-number"}),
                json.dumps({"record_type": "finding"}),
            ]
        ),
        encoding="utf-8",
    )

    assert scanner.count_packages(path) == 2


def test_read_records_ignores_a_non_object_line(tmp_path):
    path = tmp_path / "scan.ndjson"
    path.write_text(
        "\n".join(
            [
                "false",
                json.dumps({"record_type": "package", "name": "left-pad"}),
            ]
        ),
        encoding="utf-8",
    )

    assert scanner_logic.read_records(path, scanner_logic.PACKAGE) == [
        {"record_type": "package", "name": "left-pad"}
    ]
