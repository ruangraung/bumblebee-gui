# Bumblebee GUI — Handoff Document

## Context

Building a web GUI for **Bumblebee**, an open-source supply chain security scanner from Perplexity AI. The Bumblebee CLI is powerful but cumbersome for daily use — goal is a point-and-click web interface.

**Primary goal:** Personal tool for daily use on Mac (Apple Silicon).
**Future goal:** If it works well, open-source it for the community.

## What is Bumblebee?

- **Source:** https://github.com/perplexityai/bumblebee
- **Version:** v0.1.1 (as of 2026-05-27)
- **Purpose:** Read-only inventory collector for package/extension/developer-tool metadata
- **Language:** Go (single static binary, zero non-stdlib dependencies)
- **Platforms:** macOS, Linux (separate binaries per platform)
- **Output:** NDJSON (structured records)
- **License:** Apache 2.0

### What It Scans

| Ecosystem | Emitted `ecosystem` | Sources |
|-----------|---------------------|---------|
| npm/pnpm/Yarn/Bun | `npm` | `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `node_modules/` |
| PyPI | `pypi` | `*.dist-info/METADATA`, `*.egg-info/PKG-INFO` |
| Go modules | `go` | `go.sum`, `go.mod` |
| RubyGems | `rubygems` | `Gemfile.lock`, `*.gemspec` |
| Composer | `packagist` | `composer.lock` |
| MCP | `mcp` | `mcp.json`, `.mcp.json`, `claude_desktop_config.json`, etc. |
| Editor extensions | `editor-extension` | VS Code, Cursor, Windsurf, VSCodium |
| Browser extensions | `browser-extension` | Chromium-family, Firefox |

### Scan Profiles

| Profile | Scans | Use For |
|---------|-------|---------|
| `baseline` | Common global/user package roots, toolchains, extensions, MCP configs | Daily lightweight inventory |
| `project` | Configured dev directories (e.g. `~/code`, `~/src`) | Project workspace inventory |
| `deep` | Explicit `--root` paths, including broad roots like `$HOME` | Incident response, campaign checks |

### CLI Usage Examples

```bash
# Baseline scan
bumblebee scan --profile baseline > inventory.ndjson

# Project scan with explicit roots
bumblebee scan --profile project --root ~/code --root ~/Developer

# Limit to specific ecosystems
bumblebee scan --profile baseline --ecosystem npm,pypi --ecosystem go

# Exposure scan with findings
bumblebee scan --profile deep --root ~ \
  --exposure-catalog ./catalog.json \
  --findings-only \
  --max-duration 10m
```

## Bumblebee Binary Downloads

**Important:** Binaries are `.tar.gz` archives, not direct downloads.

| Platform | URL |
|----------|-----|
| Linux (x86_64) | `https://github.com/perplexityai/bumblebee/releases/download/v0.1.1/bumblebee_0.1.1_linux_amd64.tar.gz` |
| Linux (ARM64) | `https://github.com/perplexityai/bumblebee/releases/download/v0.1.1/bumblebee_0.1.1_linux_arm64.tar.gz` |
| Mac (Intel) | `https://github.com/perplexityai/bumblebee/releases/download/v0.1.1/bumblebee_0.1.1_darwin_amd64.tar.gz` |
| Mac (Apple Silicon) | `https://github.com/perplexityai/bumblebee/releases/download/v0.1.1/bumblebee_0.1.1_darwin_arm64.tar.gz` |

Checksums: `https://github.com/perplexityai/bumblebee/releases/download/v0.1.1/checksums.txt`

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Browser UI    │────▶│  Python API     │────▶│   Bumblebee     │
│   (React/TS)    │◀────│  (FastAPI)      │◀────│   CLI Binary    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Port 5173              Port 8000              Subprocess
```

### Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 18 + TypeScript | UI framework |
| **Styling** | TailwindCSS | Utility-first CSS |
| **Components** | shadcn/ui | Pre-built accessible components |
| **Charts** | Recharts | Visualization |
| **State** | Zustand | Lightweight state management |
| **Backend** | Python 3.11+ + FastAPI | API server |
| **Data** | NDJSON → JSON | Parse Bumblebee output |
| **Packaging** | GitHub Releases | Trusted distribution (no PyPI) |

## Development Workflow

### Phase 1: Development on VPS (Docker)

Develop inside Docker containers to keep VPS clean:

```bash
# Start development environment
docker compose up

# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

**Docker setup includes:**
- `backend` service — Python/FastAPI with Bumblebee Linux binary
- `frontend` service — Node/React dev server with hot reload
- Volume mounts for live code editing

### Phase 2: Testing on VPS

- Validate API correctly calls Bumblebee CLI
- Test NDJSON parsing
- Verify UI displays data correctly
- Test all scan profiles and options

### Phase 3: Packaging for Mac

Create self-contained release via GitHub Releases:
```bash
# Install (one-liner)
curl -sSL https://github.com/user/bumblebee-gui/releases/latest/download/install.sh | sh

# Or download manually from GitHub Releases
# bumblebee-gui-darwin-arm64.tar.gz
```

The release package will:
1. Bundle Python backend + dependencies
2. Bundle React frontend (built static files)
3. Include install script that sets up everything
4. Download correct Bumblebee binary for user's platform

### Phase 4: Deploy on Mac

User downloads from GitHub Releases and runs install script. Bumblebee binary downloaded from Bumblebee's GitHub Releases (same trusted chain).

## Project Structure

```
bumblebee-gui/
├── backend/
│   ├── bumblebee_gui/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI app
│   │   ├── scanner.py       # Bumblebee CLI wrapper
│   │   ├── models.py        # Pydantic models
│   │   └── cli.py           # Entry point (bumblebee-gui command)
│   ├── bin/                  # Bumblebee binary (gitignored, downloaded at install)
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── lib/             # Utilities, API client
│   │   └── stores/          # Zustand stores
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml        # Development environment
├── Dockerfile.backend
├── Dockerfile.frontend
├── pyproject.toml            # Python packaging config
├── README.md
└── .gitignore
```

## MVP Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **Dashboard** | Overview of last scan, package counts by ecosystem, findings summary | P0 |
| **Scan Config** | Select profile, pick ecosystems, set root directories | P0 |
| **Scan Execution** | Trigger scans, show progress/status | P0 |
| **Results Table** | List all packages, filterable by ecosystem, searchable | P0 |
| **Findings View** | Show exposure matches with severity (requires catalog) | P1 |
| **Export** | Download results as JSON or CSV | P1 |
| **Scan History** | Browse previous scan results | P2 |
| **Settings** | Configure default roots, save preferences | P2 |
| **Updates** | Check GitHub Releases for Bumblebee GUI and CLI updates | P2 |

## User Context

- **Primary OS:** Mac (Apple Silicon / M-series)
- **VPS:** Linux x86_64 (development environment)
- **Docker:** Available on VPS; OrbStack on Mac
- **Python:** 3.11+ on both Mac and VPS
- **Use case:** Daily supply chain inventory of personal dev machine
- **Open source plan:** Build clean from start, publish on GitHub when ready

## Important Notes

- Bumblebee scans the **local filesystem** — must run on the machine being scanned
- VPS is for **development only** — user's Mac is the actual scanning target
- Bumblebee is **read-only** — no risk of modifying the scanned system
- Keep it **simple** — the whole point is avoiding CLI complexity
- Design for **single-user local use** — no auth needed initially
- **No PyPI** — use GitHub Releases for distribution (supply chain integrity)
- **All updates via GitHub** — both Bumblebee GUI and CLI checked against GitHub Releases

## Next Steps

1. ✅ Fix handoff document (this file)
2. ✅ Brainstorm — UI/UX design complete (see docs/plans/)
3. **Save design** — Write design doc to docs/plans/
4. **Write plan** — Create implementation plan based on design
5. **Set up Docker** — Create docker-compose.yml + Dockerfiles
6. **Build backend** — FastAPI API wrapping Bumblebee CLI
7. **Build frontend** — React UI with shadcn/ui
8. **Test on VPS** — Validate full workflow
9. **Package** — Create GitHub Release with install script
10. **Deploy on Mac** — User tests in real environment
11. **Open source** — Publish on GitHub (when ready)

---

**Last updated:** 2026-05-27
**Status:** Design complete, ready for implementation planning
