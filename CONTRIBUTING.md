# Contributing

Thanks for looking. This is a small project and the process is deliberately light.

## Getting set up

```bash
git clone https://github.com/ruangraung/bumblebee-gui.git
cd bumblebee-gui
docker compose up -d
```

The frontend is at <http://localhost:5173>, the API at <http://localhost:8001>, and the API documents itself at
<http://localhost:8001/docs>. Change a file under `frontend/src` or `backend/bumblebee_gui` and it reloads.

To run the tests without Docker, see the Development section of the [README](README.md).

## What a change needs before it merges

1. **Tests where they can exist.** Pure logic belongs in `src/lib` with a test in the same directory, and the
   backend suite covers the scanner wrapper and the scan lifecycle. If something is hard to test, say so in the
   pull request and explain why, rather than leaving it silent.
2. **Five green gates.** Socket, gitleaks, the dependency audits plus tests, the build, and CodeScene. They run
   on every pull request, and CodeScene will flag a change that makes a hotspot worse or arrives unhealthy.
3. **A sentence about what you verified.** How you ran it, and what you saw. "Tests pass" is less useful than
   "ran the host-mount scan against a 780 package tree and the findings view showed the expected match".
4. **One change per pull request.** Easier to review, easier to revert.

## Commit messages

Prefixes, loosely [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `refactor`,
`docs`, `chore`, `test`, `ci`. The body explains why the change is right, not what the diff already shows.

## House rules

- **No secrets, ever.** Not in fixtures, not in tests, not in examples. There is a gitleaks hook and a CI gate,
  and both are there because it only takes one.
- **No operator fingerprints in anything the repository publishes.** Pull request bodies, issues, commit
  messages, screenshots and test fixtures use placeholder paths like `/home/you/projects`, not a real home
  directory or hostname.
- **Plain sentences in user facing copy.** No em dashes, no marketing adjectives. If a sentence would not
  survive being read out loud, rewrite it.

## Reporting security problems

Use the private route described in [SECURITY.md](SECURITY.md) rather than a public issue. A public issue that
describes a vulnerability before it is fixed puts everyone running this tool at risk.
