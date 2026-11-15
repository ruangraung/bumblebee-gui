#!/usr/bin/env bash
# Native installation is not supported yet.
#
# The backend is a FastAPI service and the frontend is a Vite build. A native
# install would have to reproduce what the container already does: a Python
# environment, the Node build, the scanner binary compiled from a pinned
# upstream commit, and the exposure catalogue set. Until that packaging work
# exists, this script refuses instead of half-installing.
#
# Supported path: Docker Compose. See README, "Quick start".

set -u

cat <<'MESSAGE'
Bumblebee GUI has no native installer yet.

This script used to download two archives and write a launcher. It now stops
before changing anything, because that path cannot work: the GUI archive it
named returns 404, and the scanner release it fetched is two versions behind and
cannot read the exposure catalogues this project ships.

Use the supported path instead:

  git clone https://github.com/ruangraung/bumblebee-gui
  cd bumblebee-gui
  docker compose up -d --build
  # then open http://localhost:5173

The README section "Quick start" carries the same steps with the expected
output, and "Scanning a directory on the host" covers the variant that reads a
host directory instead of the container's own environment.

Windows has no native path either: upstream publishes no Windows build of the
scanner.
MESSAGE

exit 1
