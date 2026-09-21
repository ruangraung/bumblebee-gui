"""What a scan root has to be for the scanner to read it.

A scan root names a path inside the scanner's own filesystem, and the scanner
runs in a container. A path that is not there is not an error to the CLI: it
exits 0 with no packages, the scan completes, and the UI shows an empty result
with nothing to explain it. A host path such as /Users/you/projects lands in
exactly that state, because the container has no such directory unless the
host-scan override mounted it.

These functions turn that silence into a sentence: what is unusable about a
root, and which directories the scanner can read instead.
"""

from pathlib import Path
from typing import Iterable, List, Optional

# The directory the host-scan override mounts read-only, so roots under it
# reach the host. See docker-compose.host-scan.yml.
HOST_MOUNT = Path("/host")

# Enough to recognise the mount, short enough for one line of UI copy.
OFFER_LIMIT = 6


def _entries(path: Path) -> List[Path]:
    """Directory entries, or none when the directory cannot be listed."""
    try:
        return list(path.iterdir())
    except OSError:
        return []


def directories_on_offer(host_mount: Path = HOST_MOUNT, limit: int = OFFER_LIMIT) -> List[str]:
    """Top-level directories under the host mount, sorted and capped.

    An absent or unreadable mount offers nothing instead of raising: this list
    only ever ends up inside an error message.
    """
    found = sorted(entry for entry in _entries(host_mount) if entry.is_dir())
    return [str(entry) for entry in found[:limit]]


def _offer_line(host_mount: Path) -> str:
    """What the scanner can read, for a root it cannot."""
    offered = directories_on_offer(host_mount)
    if not offered:
        return (
            f"Nothing is mounted at {host_mount}. Start the stack with "
            "-f docker-compose.host-scan.yml and BUMBLEBEE_HOST_DIR pointing at a "
            "directory that exists on the host; the README has the command."
        )
    return (
        f"Directories the scanner can read under {host_mount} include: "
        f"{', '.join(offered)}."
    )


def _empty_hint(path: Path, host_mount: Path) -> str:
    """Why an empty directory is empty, when the host mount is the likely cause.

    Docker creates a missing bind-mount source rather than refusing to start, so
    a BUMBLEBEE_HOST_DIR typo produces a scan of an empty directory that reports
    success.
    """
    if path == host_mount or host_mount in path.parents:
        return (
            "An empty host mount usually means BUMBLEBEE_HOST_DIR named a directory "
            "that does not exist on the host: Docker creates it and mounts it empty. "
            "Point it at a directory that exists and restart the stack."
        )
    return (
        "Choose a directory that holds projects, or leave roots empty to scan the "
        "scanner's own environment."
    )


def problem_for_root(root: str, host_mount: Path = HOST_MOUNT) -> Optional[str]:
    """What rules one scan root out, or None when the scanner can read it.

    A relative root is resolved the way the CLI resolves it, against the working
    directory it runs in, and the message names that resolved path. A literal
    ``~`` is not expanded: the CLI receives it unexpanded too.
    """
    path = Path(root)
    if not path.exists():
        where = (
            f"Root {root} does not exist inside the scanner container."
            if path.is_absolute()
            else f"Root {root} resolves to {path.resolve()}, which does not exist "
            "inside the scanner container."
        )
        return f"{where} A scan of a path that is not there reports no packages. {_offer_line(host_mount)}"
    if not path.is_dir():
        return f"Root {root} is a file. A scan root has to be a directory."
    if not _entries(path):
        return (
            f"Root {root} is empty, so a scan of it reports no packages. "
            f"{_empty_hint(path, host_mount)}"
        )
    return None


def root_problems(
    roots: Optional[Iterable[str]], host_mount: Path = HOST_MOUNT
) -> List[str]:
    """Every problem across the requested roots, in the order they were given."""
    return [
        problem
        for problem in (problem_for_root(root, host_mount) for root in roots or ())
        if problem
    ]


# A directory listing is for picking a root by eye, not for walking a tree.
LISTING_LIMIT = 200


def inside_mount(path: str, host_mount: Path = HOST_MOUNT) -> bool:
    """Whether a path is the host mount or a directory below it.

    The listing endpoint is confined to the mount on purpose: the scanner is a
    container, and this exposes what it was given rather than the filesystem it
    runs on.
    """
    candidate = Path(path).resolve()
    root = host_mount.resolve()
    return candidate == root or root in candidate.parents


def host_mount_report(
    path: str = "", host_mount: Path = HOST_MOUNT, limit: int = LISTING_LIMIT
) -> dict:
    """What the host mount holds, for the requested directory.

    ``mounted`` false is a state the UI shows rather than an error: the scanner
    still runs, it just reads nothing but its own environment.
    """
    target = Path(path) if path else host_mount
    if not host_mount.is_dir():
        return {"mounted": False, "path": str(target), "parent": None, "directories": []}

    directories = sorted(
        str(entry) for entry in _entries(target) if entry.is_dir()
    )[:limit]
    at_root = target.resolve() == host_mount.resolve()
    return {
        "mounted": True,
        "path": str(target),
        "parent": None if at_root else str(target.parent),
        "directories": directories,
    }
