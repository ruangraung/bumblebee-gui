import json

from bumblebee_gui.catalogue import catalogue_summary


def _catalogue(directory, name: str, entries) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    (directory / name).write_text(json.dumps({"schema_version": "0.1.0", "entries": entries}))


def test_counts_catalogues_entries_and_versions(tmp_path):
    _catalogue(
        tmp_path,
        "one.json",
        [
            {"id": "a", "versions": ["1.0.0", "1.0.1"]},
            {"id": "b", "versions": ["2.0.0"]},
        ],
    )
    _catalogue(tmp_path, "two.json", [{"id": "c", "versions": ["3.0.0"]}])

    summary = catalogue_summary(tmp_path)

    assert summary == {
        "catalogues": 2,
        "entries": 3,
        "versions": 4,
        "available": True,
    }


def test_an_entry_without_versions_still_counts(tmp_path):
    _catalogue(tmp_path, "one.json", [{"id": "a"}])

    summary = catalogue_summary(tmp_path)

    assert summary["entries"] == 1
    assert summary["versions"] == 0


def test_a_malformed_file_is_skipped(tmp_path):
    _catalogue(tmp_path, "good.json", [{"id": "a", "versions": ["1.0.0"]}])
    (tmp_path / "broken.json").write_text("{not json")
    (tmp_path / "shapeless.json").write_text(json.dumps({"entries": "nope"}))

    summary = catalogue_summary(tmp_path)

    assert summary["catalogues"] == 1
    assert summary["versions"] == 1


def test_a_missing_directory_counts_nothing_and_says_so(tmp_path):
    summary = catalogue_summary(tmp_path / "absent")

    assert summary["available"] is False
    assert summary["catalogues"] == 0
    assert summary["versions"] == 0
