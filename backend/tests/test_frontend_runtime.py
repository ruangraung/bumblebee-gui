"""The shipped frontend serves the built bundle, not the Vite dev server.

The default compose target is what the README tells every user to run, so it
must serve the built dist through a production server. Caddy serves the static
bundle and proxies /api to the backend; the Vite dev server survives only as an
opt-in development target.
"""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCKERFILE = REPO_ROOT / "Dockerfile.frontend"
CADDYFILE = REPO_ROOT / "frontend" / "Caddyfile"
COMPOSE = REPO_ROOT / "docker-compose.yml"
DEV_COMPOSE = REPO_ROOT / "docker-compose.dev.yml"


def _last_line_starting(text: str, prefix: str) -> str:
    matches = [line for line in text.splitlines() if line.startswith(prefix)]
    return matches[-1] if matches else ""


def test_production_runtime_is_caddy():
    text = DOCKERFILE.read_text(encoding="utf-8")
    last_from = _last_line_starting(text, "FROM ")
    assert last_from.startswith("FROM caddy"), "the default stage must be Caddy"
    last_cmd = _last_line_starting(text, "CMD ")
    assert "caddy" in last_cmd


def test_runtime_command_is_not_the_dev_server():
    text = DOCKERFILE.read_text(encoding="utf-8")
    last_cmd = _last_line_starting(text, "CMD ")
    assert "npm" not in last_cmd


def test_build_stage_produces_the_bundle():
    text = DOCKERFILE.read_text(encoding="utf-8")
    assert "npm run build" in text


def test_caddyfile_proxies_api_to_backend():
    assert CADDYFILE.is_file(), "frontend/Caddyfile is missing"
    text = CADDYFILE.read_text(encoding="utf-8")
    assert "reverse_proxy" in text
    assert "backend:8000" in text
    assert "/api" in text
    assert "handle /api/*" in text


def test_default_compose_has_no_frontend_source_mount():
    text = COMPOSE.read_text(encoding="utf-8")
    assert "./frontend:/app" not in text


def test_dev_override_exists_and_mounts_source():
    assert DEV_COMPOSE.is_file(), "docker-compose.dev.yml is missing"
    text = DEV_COMPOSE.read_text(encoding="utf-8")
    assert "./frontend:/app" in text


def test_dev_override_targets_the_dev_stage():
    text = DEV_COMPOSE.read_text(encoding="utf-8")
    assert "target: dev" in text
