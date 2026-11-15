#!/usr/bin/env bash
# Stand-in scanner for the browser tests in CI.
#
# The suites need the GUI to render with a healthy API: `/api/scanner` answering
# in the shape the backend parses, so pages stay free of console errors. They do
# not need real supply-chain data, and building the pinned Go binary on every
# pull request would add minutes for nothing. `BUMBLEBEE_BINARY` points the
# backend at this script instead.
#
# It is deliberately narrow: it answers the version subcommand and exits clean
# for anything else, so a scan started by accident produces no findings rather
# than inventing output.
set -u

case "${1:-}" in
  version | --version)
    printf 'bumblebee v0.0.0-ci\n'
    printf 'commit: 0000000000\n'
    printf 'built: unknown\n'
    ;;
esac

exit 0
