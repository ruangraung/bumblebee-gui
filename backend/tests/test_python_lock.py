"""The backend image installs a hashed, fully pinned Python lock.

requirements.txt names the direct dependencies and floors the vulnerable
transitive ones, but on its own it lets the rest of the tree resolve fresh and
unverified on every build. The generated lock pins every package by version and
sha256, and the image installs it with --require-hashes so an unverified or
substituted package cannot be installed.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
LOCK = REPO_ROOT / "backend" / "requirements.lock"
REQUIREMENTS = REPO_ROOT / "backend" / "requirements.txt"
DOCKERFILE = REPO_ROOT / "Dockerfile.backend"


def _normalise(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def _lock_requirements() -> list[str]:
    text = LOCK.read_text(encoding="utf-8")
    joined = text.replace("\\\n", " ")
    lines = []
    for line in joined.splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            lines.append(line)
    return lines


def _is_requirement_line(line: str) -> bool:
    if not line:
        return False
    if line.startswith("#"):
        return False
    return not line.startswith("-r")


def _direct_requirement_names() -> set[str]:
    names = set()
    for line in REQUIREMENTS.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not _is_requirement_line(line):
            continue
        match = re.match(r"^([A-Za-z0-9_.-]+)", line)
        if match:
            names.add(_normalise(match.group(1)))
    return names


def test_hashed_lock_exists():
    assert LOCK.is_file(), "backend/requirements.lock is missing"


def test_dockerfile_installs_from_hashed_lock():
    text = DOCKERFILE.read_text(encoding="utf-8")
    assert "requirements.lock" in text
    assert "--require-hashes" in text


def test_every_locked_package_is_pinned_and_hashed():
    requirements = _lock_requirements()
    assert requirements, "the lock pins nothing"
    for requirement in requirements:
        name = re.match(r"^([A-Za-z0-9_.-]+)", requirement)
        assert name is not None, f"unparseable lock line: {requirement}"
        assert "==" in requirement, f"{name.group(1)} is not pinned to a version"
        assert "--hash=sha256:" in requirement, f"{name.group(1)} carries no hash"


def test_lock_covers_every_direct_requirement():
    locked = set()
    for requirement in _lock_requirements():
        match = re.match(r"^([A-Za-z0-9_.-]+)==", requirement)
        if match:
            locked.add(_normalise(match.group(1)))
    missing = _direct_requirement_names() - locked
    assert not missing, f"the lock does not pin: {sorted(missing)}"
