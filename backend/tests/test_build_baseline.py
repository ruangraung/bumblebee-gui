"""The frontend image and CI must build on the same Node major.

The image is the only place the frontend is installed outside CI, so a
different major means dependencies resolve against a runtime nobody tested.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCKERFILE = REPO_ROOT / "Dockerfile.frontend"
WORKFLOW = REPO_ROOT / ".github" / "workflows" / "ci.yml"


def _docker_node_major() -> int | None:
    text = DOCKERFILE.read_text(encoding="utf-8")
    match = re.search(r"^FROM node:(\d+)", text, re.MULTILINE)
    return int(match.group(1)) if match else None


def _ci_node_major() -> int | None:
    text = WORKFLOW.read_text(encoding="utf-8")
    match = re.search(r'node-version:\s*"(\d+)"', text)
    return int(match.group(1)) if match else None


def test_dockerfile_pins_a_node_major():
    assert _docker_node_major() is not None


def test_ci_pins_a_node_major():
    assert _ci_node_major() is not None


def test_container_node_matches_ci():
    container = _docker_node_major()
    ci = _ci_node_major()
    assert container is not None and ci is not None
    assert container == ci, f"container builds on node {container}, CI pins node {ci}"
