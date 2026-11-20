"""The backend image runs unprivileged; only development gets hot reload.

The runtime command must not carry --reload, and the image must declare a
non-root user so a compromised server process does not own the container. The
dev compose adds --reload back, keeping hot reload a development convenience
rather than a production default.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCKERFILE = REPO_ROOT / "Dockerfile.backend"
COMPOSE = REPO_ROOT / "docker-compose.yml"


def _dockerfile_cmd() -> str:
    text = DOCKERFILE.read_text(encoding="utf-8")
    match = re.search(r"^CMD (.+)$", text, re.MULTILINE)
    return match.group(1) if match else ""


def test_runtime_command_has_no_reload():
    cmd = _dockerfile_cmd()
    assert cmd, "Dockerfile.backend has no CMD"
    assert "--reload" not in cmd


def test_image_runs_as_an_unprivileged_user():
    text = DOCKERFILE.read_text(encoding="utf-8")
    match = re.search(r"^USER (\S+)", text, re.MULTILINE)
    assert match is not None, "Dockerfile.backend declares no USER"
    assert match.group(1) != "root"


def test_dev_compose_keeps_hot_reload():
    text = COMPOSE.read_text(encoding="utf-8")
    assert "--reload" in text, "the dev compose must add --reload back"
