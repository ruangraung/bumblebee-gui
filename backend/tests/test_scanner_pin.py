"""The image's scanner comes from a pinned commit, not a release asset.

Upstream has published no release since v0.1.2, while its catalogues moved to
schema 0.2.0, which v0.1.2 refuses to load. A release download would therefore
ship a binary that cannot read the data next to it, so the build resolves a
commit instead. These guard the two halves of that decision.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCKERFILE = REPO_ROOT / "Dockerfile.backend"
MANIFEST = REPO_ROOT / "threat-intel.manifest"

COMMIT_ARG = re.compile(r"BUMBLEBEE_COMMIT=([0-9a-fA-F]{40})")
RELEASE_DOWNLOAD = re.compile(r"releases/download")


def test_scanner_is_built_from_a_pinned_commit():
    text = DOCKERFILE.read_text(encoding="utf-8")
    match = COMMIT_ARG.search(text)
    assert match, "Dockerfile.backend must pin BUMBLEBEE_COMMIT to a 40-character commit"
    assert f'git rev-parse HEAD' in text, "the build must assert the checked-out commit"


def test_scanner_is_not_fetched_from_a_release():
    # A release asset reappearing here means the binary and the catalogues can
    # drift apart again, which is the defect this pin exists to prevent.
    assert not RELEASE_DOWNLOAD.search(DOCKERFILE.read_text(encoding="utf-8"))


def test_manifest_lists_every_catalogue_once():
    lines = [line for line in MANIFEST.read_text(encoding="utf-8").splitlines() if line.strip()]
    names = [line.split()[1] for line in lines]
    assert len(names) == len(set(names)), "a catalogue is listed twice"
    for line in lines:
        digest, _, name = line.partition("  ")
        assert re.fullmatch(r"[0-9a-fA-F]{64}", digest), f"{name} has no sha256"
        assert name.endswith(".json"), f"{name} is not a catalogue"
