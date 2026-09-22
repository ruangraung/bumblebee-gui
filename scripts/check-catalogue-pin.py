#!/usr/bin/env python3
"""Report whether the pinned exposure catalogues are still current.

The image ships upstream's threat_intel set from a pinned commit, with every
file's sha256 listed in threat-intel.manifest. That pin is the whole of what a
scan compares packages against, so a pin that has fallen behind a published
release is a scan that cannot report the campaigns published since.

This script reads the pin, asks GitHub what upstream's latest release is, and
prints one report:

  - the pinned commit, and the tag upstream points at it
  - whether that commit is upstream's latest release, behind it, or unknown
  - every manifest digest, checked against the file at the pinned commit
  - upstream files absent from the manifest, which the image would not ship
  - the entry count, which is the number a reviewer compares against the figure
    quoted in README.md

It is read-only: the only network calls are GETs to the GitHub API and to
raw.githubusercontent.com, and nothing is written outside stdout. Exit code 0
means current and verified, 1 means the report found a problem, 2 means the
check could not be completed.

Stdlib only, so a runner needs no install step.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DOCKERFILE = REPO_ROOT / "Dockerfile.backend"
MANIFEST = REPO_ROOT / "threat-intel.manifest"

UPSTREAM_REPO = "perplexityai/bumblebee"
CATALOGUE_DIR = "threat_intel"
COMMIT_ARG = re.compile(r"BUMBLEBEE_THREAT_INTEL_COMMIT=([0-9a-fA-F]{40})")
MANIFEST_LINE = re.compile(r"^([0-9a-fA-F]{64})\s+(\S+)$")

EXIT_OK = 0
EXIT_PROBLEM = 1
EXIT_UNKNOWN = 2


class Unreachable(Exception):
    """A request that never produced a usable answer."""


def get(url: str, token: str | None) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "bumblebee-gui-catalogue-pin-check"})
    request.add_header("Accept", "application/vnd.github+json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        raise Unreachable(f"HTTP {error.code} from {url}") from error
    except urllib.error.URLError as error:
        raise Unreachable(f"{error.reason} from {url}") from error


def get_json(url: str, token: str | None):
    return json.loads(get(url, token))


def read_pinned_commit() -> str:
    text = DOCKERFILE.read_text()
    match = COMMIT_ARG.search(text)
    if not match:
        raise Unreachable(f"no BUMBLEBEE_THREAT_INTEL_COMMIT found in {DOCKERFILE.name}")
    return match.group(1).lower()


def read_manifest() -> tuple[dict[str, str], list[str]]:
    digests: dict[str, str] = {}
    malformed: list[str] = []
    for line in MANIFEST.read_text().splitlines():
        if not line.strip():
            continue
        match = MANIFEST_LINE.match(line.strip())
        if not match:
            malformed.append(line)
            continue
        digests[match.group(2)] = match.group(1).lower()
    return digests, malformed


def latest_release(repo: str, token: str | None) -> dict:
    # releases/latest skips drafts and pre-releases, so only a published release
    # counts as a reason to bump the pin.
    release = get_json(f"https://api.github.com/repos/{repo}/releases/latest", token)
    tag = release["tag_name"]
    commit = get_json(f"https://api.github.com/repos/{repo}/commits/{tag}", token)["sha"].lower()
    return {
        "tag": tag,
        "published_at": release.get("published_at") or "unknown",
        "html_url": release.get("html_url") or "",
        "commit": commit,
    }


def tag_for_commit(repo: str, commit: str, token: str | None) -> str | None:
    tags = get_json(f"https://api.github.com/repos/{repo}/tags?per_page=100", token)
    for tag in tags:
        if tag.get("commit", {}).get("sha", "").lower() == commit:
            return tag["name"]
    return None


def pin_status(repo: str, pinned: str, release: dict, token: str | None) -> tuple[str, str]:
    """Return (state, sentence) where state is current, stale, ahead or diverged.

    GitHub's compare endpoint reports the status of the head commit relative to
    the base, so comparing the pin (base) with the release commit (head) reads
    as "ahead" when the release is ahead of the pin, which is a stale pin.
    """
    if pinned == release["commit"]:
        return "current", f"the pin is upstream's latest release, {release['tag']}"
    comparison = get_json(
        f"https://api.github.com/repos/{repo}/compare/{pinned}...{release['commit']}", token
    )
    state = comparison.get("status")
    if state == "ahead":
        return "stale", (
            f"the pin is {comparison.get('ahead_by')} commit(s) behind {release['tag']}"
            f", upstream's latest release"
        )
    if state == "behind":
        return "ahead", (
            f"the pin is {comparison.get('behind_by')} commit(s) past {release['tag']}"
            f", so it is not that release's commit"
        )
    if state == "diverged":
        return "diverged", f"the pin is not on the history of {release['tag']}"
    return "current", f"upstream reports no difference from {release['tag']}"


def check_digests(repo: str, pinned: str, digests: dict[str, str], token: str | None) -> dict:
    ok: list[str] = []
    mismatched: list[tuple[str, str, str]] = []
    unreadable: list[tuple[str, str]] = []
    entries = 0
    for name, expected in sorted(digests.items()):
        url = f"https://raw.githubusercontent.com/{repo}/{pinned}/{CATALOGUE_DIR}/{name}"
        try:
            body = get(url, token)
        except Unreachable as error:
            unreadable.append((name, str(error)))
            continue
        actual = hashlib.sha256(body).hexdigest()
        if actual != expected:
            mismatched.append((name, expected, actual))
            continue
        ok.append(name)
        try:
            document = json.loads(body)
        except ValueError:
            unreadable.append((name, "file matches its digest but is not JSON"))
            continue
        listed = document.get("entries") if isinstance(document, dict) else None
        if isinstance(listed, list):
            entries += len(listed)
        else:
            unreadable.append((name, "file matches its digest but lists no entries"))
    return {"ok": ok, "mismatched": mismatched, "unreadable": unreadable, "entries": entries}


def upstream_files(repo: str, pinned: str, token: str | None) -> tuple[list[str], list[str]]:
    listing = get_json(
        f"https://api.github.com/repos/{repo}/contents/{CATALOGUE_DIR}?ref={pinned}", token
    )
    return sorted(entry["name"] for entry in listing if entry["name"].endswith(".json")), []


def report(args: argparse.Namespace) -> int:
    token = os.environ.get("GITHUB_TOKEN") or None
    pinned = (args.commit or read_pinned_commit()).lower()
    digests, malformed = read_manifest()

    print("Catalogue pin check")
    print(f"  pinned commit   {pinned}  (from {DOCKERFILE.name})")
    print(f"  manifest        {MANIFEST.name}: {len(digests)} file(s) listed")

    release = latest_release(args.repo, token)
    pinned_tag = tag_for_commit(args.repo, pinned, token)
    state, sentence = pin_status(args.repo, pinned, release, token)

    print(f"  pinned tag      {pinned_tag or 'no upstream tag points at this commit'}")
    print(f"  upstream latest {release['tag']} released {release['published_at']}")
    print(f"  pin status      {state.upper()}: {sentence}")

    problems: list[str] = []
    if malformed:
        problems.append(f"{len(malformed)} manifest line(s) are not 'sha256  name'")
        for line in malformed:
            print(f"                  MALFORMED  {line}")
    if state == "stale":
        problems.append(f"the pin is behind {release['tag']}")
    if state == "diverged":
        problems.append(f"the pin is not on the history of {release['tag']}")
    if state == "ahead":
        print(
            "                  note: the pin is not the commit of a published release,"
            " so there is no release to be behind"
        )

    if args.skip_digests:
        print("  digests         skipped (--skip-digests)")
        entries = None
    else:
        result = check_digests(args.repo, pinned, digests, token)
        print(
            f"  digests         {len(result['ok'])} verified,"
            f" {len(result['mismatched'])} mismatched,"
            f" {len(result['unreadable'])} unreadable"
        )
        for name, expected, actual in result["mismatched"]:
            print(f"                  MISMATCH   {name}")
            print(f"                             manifest {expected}")
            print(f"                             upstream {actual}")
        for name, why in result["unreadable"]:
            print(f"                  UNREADABLE {name}: {why}")
        if result["mismatched"]:
            problems.append(f"{len(result['mismatched'])} manifest digest(s) do not match upstream")
        if result["unreadable"]:
            problems.append(f"{len(result['unreadable'])} catalogue(s) could not be read")
        entries = result["entries"]

        listed, _ = upstream_files(args.repo, pinned, token)
        missing = [name for name in listed if name not in digests]
        extra = [name for name in digests if name not in listed]
        print(f"  upstream files  {len(listed)} at the pinned commit, {len(missing)} absent from the manifest")
        for name in missing:
            print(f"                  NOT SHIPPED {name} exists upstream but not in the manifest")
        for name in extra:
            print(f"                  NOT UPSTREAM {name} is in the manifest but not upstream")
        if missing:
            problems.append(f"{len(missing)} upstream catalogue(s) the manifest does not list")
        if extra:
            problems.append(f"{len(extra)} manifest entr(ies) upstream does not have")

    if entries is not None:
        print(f"  entry count     {entries} entries across the listed catalogues")

    if problems:
        print("  verdict         ACTION NEEDED")
        for problem in problems:
            print(f"                  - {problem}")
        return EXIT_PROBLEM

    if args.skip_digests:
        print("  verdict         CURRENT: the pin is upstream's latest release (digests not checked)")
    else:
        print("  verdict         CURRENT: the pin matches upstream's latest release and verifies")
    return EXIT_OK


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Report whether the pinned exposure catalogues are still current."
    )
    parser.add_argument("--repo", default=UPSTREAM_REPO, help=f"upstream repository (default {UPSTREAM_REPO})")
    parser.add_argument("--commit", help="check this commit instead of the pin in Dockerfile.backend")
    parser.add_argument("--skip-digests", action="store_true", help="skip the per-file sha256 download")
    args = parser.parse_args()
    try:
        return report(args)
    except Unreachable as error:
        print(f"  verdict         UNKNOWN: {error}")
        return EXIT_UNKNOWN


if __name__ == "__main__":
    sys.exit(main())
