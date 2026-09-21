"""Rules for scan roots, exercised against real directories in a temp tree."""

from pathlib import Path

from bumblebee_gui.roots import (
    directories_on_offer,
    host_mount_report,
    inside_mount,
    problem_for_root,
    root_problems,
)


def _project_like(path: Path) -> Path:
    """A directory the scanner can read: it exists, and it holds something."""
    path.mkdir(parents=True, exist_ok=True)
    (path / "package.json").write_text("{}")
    return path


def _refusal(root: str, host_mount: Path) -> str:
    """The message that rules a root out, failing the test if it is accepted."""
    message = problem_for_root(root, host_mount=host_mount)
    assert message is not None, f"expected {root} to be refused"
    return message


def test_readable_root_is_accepted(tmp_path):
    project = _project_like(tmp_path / "project")

    assert problem_for_root(str(project), host_mount=tmp_path / "host") is None


def test_missing_root_is_refused_and_names_what_is_readable(tmp_path):
    mount = tmp_path / "host"
    readable = _project_like(mount / "projects")

    message = _refusal(str(mount / "projectz"), mount)

    assert "does not exist" in message
    assert "reports no packages" in message
    assert str(readable) in message


def test_relative_root_names_what_it_resolves_to(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    message = _refusal("nope", tmp_path / "host")

    assert str(tmp_path / "nope") in message


def test_file_root_is_refused(tmp_path):
    target = tmp_path / "notes.txt"
    target.write_text("hi")

    assert "is a file" in _refusal(str(target), tmp_path / "host")


def test_empty_root_is_refused_with_the_mount_diagnosis(tmp_path):
    mount = tmp_path / "host"
    mount.mkdir()

    message = _refusal(str(mount), mount)

    assert "empty" in message
    assert "BUMBLEBEE_HOST_DIR" in message


def test_empty_directory_outside_the_mount_gets_no_host_diagnosis(tmp_path):
    empty = tmp_path / "empty"
    empty.mkdir()

    message = _refusal(str(empty), tmp_path / "host")

    assert "BUMBLEBEE_HOST_DIR" not in message
    assert "Choose a directory" in message


def test_no_mount_offers_the_command_that_makes_one(tmp_path):
    message = _refusal(str(tmp_path / "anything"), tmp_path / "absent")

    assert "Nothing is mounted" in message
    assert "docker-compose.host-scan.yml" in message


def test_roots_with_no_problems_report_none(tmp_path):
    project = _project_like(tmp_path / "project")

    assert root_problems([str(project)], host_mount=tmp_path / "absent") == []


def test_no_roots_report_none():
    assert root_problems(None) == []


def test_every_root_is_checked(tmp_path):
    project = _project_like(tmp_path / "project")

    problems = root_problems(
        [str(project), str(tmp_path / "gone")], host_mount=tmp_path / "absent"
    )

    assert len(problems) == 1


def test_directories_on_offer_lists_directories_only(tmp_path):
    mount = tmp_path / "host"
    project = _project_like(mount / "projects")
    (mount / "README.md").write_text("hi")

    assert directories_on_offer(mount) == [str(project)]


def test_directories_on_offer_is_empty_without_a_mount(tmp_path):
    assert directories_on_offer(tmp_path / "absent") == []


def test_inside_mount_accepts_the_mount_and_its_children(tmp_path):
    mount = tmp_path / "host"
    project = _project_like(mount / "projects")

    assert inside_mount(str(mount), mount)
    assert inside_mount(str(project), mount)


def test_inside_mount_refuses_anything_outside(tmp_path):
    mount = tmp_path / "host"
    mount.mkdir()

    assert not inside_mount(str(tmp_path / "elsewhere"), mount)
    assert not inside_mount("/etc", mount)


def test_mount_report_lists_directories_at_the_root(tmp_path):
    mount = tmp_path / "host"
    project = _project_like(mount / "projects")
    (mount / "README.md").write_text("hi")

    report = host_mount_report(host_mount=mount)

    assert report["mounted"] is True
    assert report["directories"] == [str(project)]
    assert report["parent"] is None


def test_mount_report_names_the_parent_below_the_root(tmp_path):
    mount = tmp_path / "host"
    inner = _project_like(mount / "projects" / "api")

    report = host_mount_report(str(inner), host_mount=mount)

    assert report["parent"] == str(inner.parent)


def test_mount_report_says_so_when_nothing_is_mounted(tmp_path):
    report = host_mount_report(host_mount=tmp_path / "absent")

    assert report["mounted"] is False
    assert report["directories"] == []
