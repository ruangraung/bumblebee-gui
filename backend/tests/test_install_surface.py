"""Advertised install surfaces must not promise what the repository cannot do.

``install.sh`` fetched two archives, one of which 404s, and ``pyproject.toml``
declared a console script whose module was never written. Both are the same
defect class as a copy string that lies: the reader follows the documented path
and gets a half-install. These run the installer for real rather than grepping
it.
"""

import subprocess
import tomllib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
INSTALLER = REPO_ROOT / "install.sh"
PYPROJECT = REPO_ROOT / "pyproject.toml"


def test_installer_refuses_and_names_the_supported_path(tmp_path):
    completed = subprocess.run(
        ["bash", str(INSTALLER)],
        capture_output=True,
        text=True,
        timeout=60,
        env={"HOME": str(tmp_path), "PATH": "/usr/bin:/bin"},
    )

    output = completed.stdout + completed.stderr
    assert completed.returncode != 0, "a refusing installer must exit non-zero"
    assert "docker compose" in output, "the refusal has to name the path that works"
    assert "README" in output, "the refusal has to point at the documentation"


def test_refusing_installer_changes_nothing_in_home(tmp_path):
    subprocess.run(
        ["bash", str(INSTALLER)],
        capture_output=True,
        text=True,
        timeout=60,
        env={"HOME": str(tmp_path), "PATH": "/usr/bin:/bin"},
    )

    assert not (tmp_path / ".bumblebee-gui").exists(), "it must not create install directories"
    assert not (tmp_path / ".bashrc").exists(), "it must not write a shell profile"
    assert not (tmp_path / ".zshrc").exists(), "it must not write a shell profile"


def test_declared_console_scripts_resolve_to_real_modules():
    project = tomllib.loads(PYPROJECT.read_text(encoding="utf-8")).get("project", {})

    for name, target in project.get("scripts", {}).items():
        module_path, _, attribute = target.partition(":")
        assert module_path, f"{name} declares no module"
        assert attribute, f"{name} declares no callable"
        candidate = REPO_ROOT / "backend" / Path(*module_path.split("."))
        assert candidate.with_suffix(".py").exists() or (candidate / "__init__.py").exists(), (
            f"{name} points at {module_path}, which does not exist in the repository"
        )
