# Bumblebee GUI

A web interface for [Bumblebee](https://github.com/perplexityai/bumblebee), the open-source supply chain security scanner from Perplexity AI.

## Why?

Bumblebee is a powerful CLI tool for scanning local filesystems for package metadata across multiple ecosystems (npm, PyPI, Go, Ruby, etc.). But CLI tools aren't for everyone. **Bumblebee GUI** wraps it in a clean web interface so you can:

- 🔍 Run scans with point-and-click
- 📊 Visualize findings with charts and tables
- 🔎 Filter and search results
- 📥 Export data as JSON/CSV
- 🌙 Dark/light theme support

## Project Status

Actively developed (as of August 2026):

- **Background scan execution** — scans no longer block the browser. `POST /api/scans` returns immediately (`202`); the scan runs server-side (NDJSON streamed to disk line-by-line) and the UI streams status via **Server-Sent Events** (with polling fallback) until completion. Running scans report live progress (`packages_found`) and can be cancelled — the CLI process is killed and the partial output cleaned up.
- **Modern frontend stack** — migrated to **Vite 8 (Rolldown engine)** + **react-router 7**; zero known dependency vulnerabilities (`npm audit` / `pip-audit` clean).
- **Hardened CI pipeline** — every push/PR runs four gates: Socket supply-chain scan, gitleaks secret scan, dependency audits (hard gates), and builds (tsc + vite + pytest).
- **Backend test suite** — 32 pytest tests covering the scanner's pure functions, the real subprocess streaming/cancellation path, the async scan lifecycle, and SSE event streaming.

## Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Overview of packages by ecosystem, recent scans |
| **Scan Configuration** | Select profile, ecosystems, root directories |
| **Scan Execution** | Async scans with live status streaming (SSE) — the browser stays responsive |
| **Results Table** | Filterable, searchable package list |
| **Findings View** | Exposure matches with severity levels |
| **Export** | Download as JSON or CSV |
| **Settings** | Theme, presets, data management |

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/ruangraung/bumblebee-gui.git
cd bumblebee-gui

# Start with Docker
docker compose up -d

# Open in browser
# Frontend: http://localhost:5173
# Backend API: http://localhost:8001
# API Docs: http://localhost:8001/docs
```

### First Scan

1. Open http://localhost:5173
2. Click **Scan** in the sidebar
3. Select a profile (baseline, project, or deep)
4. Click **Start Scan** — the scan starts in the background
5. Results appear automatically on the Results page once the scan completes (deep scans can take a few minutes)

### Scanning a directory on the host

The backend runs in a container, so by default a scan sees only the container's own filesystem. To scan a
directory that lives on the host, mount it read-only at `/host`:

```bash
BUMBLEBEE_HOST_DIR=/home/you/projects \
  docker compose -f docker-compose.yml -f docker-compose.host-scan.yml up -d backend
```

Then use `/host`, or any path under it, as the scan root. The mount is read-only: the scanner reads package
metadata, and nothing in the container can change what it sees. Everything under the mounted directory does
become readable by the backend, which listens on localhost only, so mount the narrowest directory that
answers your question.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Browser UI    │────▶│  Python API     │────▶│   Bumblebee     │
│   (React/TS)    │◀────│  (FastAPI)      │◀────│   CLI Binary    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Port 5173              Port 8001              Subprocess
```

### Scan lifecycle

Scans execute as background tasks so the API never blocks on the CLI:

1. `POST /api/scans` → creates a `running` record (output path reserved up front) and returns **202** immediately
2. The scan runs detached; the CLI's NDJSON output is **streamed to disk line-by-line** as it is produced
3. The UI subscribes to `GET /api/scans/{id}/events` (Server-Sent Events) — status transitions `running → completed` (or `failed`); progress events stream `packages_found` live as packages are discovered
4. On completion, `GET /api/scans/{id}/packages` and `/findings` stream the results
5. `DELETE /api/scans/{id}` while running cancels the scan — the background task is cancelled, the CLI subprocess killed, and the partial NDJSON file removed

### Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 18 + TypeScript | UI framework |
| **Build tooling** | Vite 8 (Rolldown) + react-router 7 | Dev server, bundling, routing |
| **Styling** | TailwindCSS + shadcn/ui | Styling and components |
| **Charts** | Recharts | Data visualization |
| **State** | Zustand | State management |
| **Backend** | Python 3.11+ + FastAPI | API server |
| **Database** | SQLite (aiosqlite) | Scan metadata storage |
| **Scanner** | Bumblebee CLI | Package scanning |

## Project Structure

```
bumblebee-gui/
├── backend/
│   ├── bumblebee_gui/
│   │   ├── main.py          # FastAPI app + API endpoints (async scan lifecycle)
│   │   ├── scanner.py       # Bumblebee CLI wrapper
│   │   ├── database.py      # SQLite operations
│   │   └── models.py        # Pydantic models
│   ├── tests/               # pytest suite (scanner + API lifecycle)
│   ├── requirements.txt     # Runtime dependencies
│   └── requirements-dev.txt # Dev dependencies (pytest, httpx2)
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── lib/             # Utilities, API client
│   │   └── stores/          # Zustand stores
│   └── package.json
├── .github/workflows/ci.yml # CI pipeline (4 gates)
├── docker-compose.yml       # Development environment
├── Dockerfile.backend       # Backend container
├── Dockerfile.frontend      # Frontend container
└── install.sh               # Installation script
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/scans` | Submit a scan — returns `202` + `running` record; runs in background |
| `GET` | `/api/scans` | List recent scans |
| `GET` | `/api/scans/{id}` | Get scan details (includes live `packages_found` while running) |
| `GET` | `/api/scans/{id}/events` | Server-Sent Events stream: `snapshot` → `progress` → `completed`/`failed`/`cancelled` |
| `DELETE` | `/api/scans/{id}` | Delete a scan — cancels it first if it is still running |
| `GET` | `/api/scans/{id}/packages` | Get packages from a completed scan |
| `GET` | `/api/scans/{id}/findings` | Get findings from a completed scan |
| `GET` | `/api/scans/{id}/export` | Export scan data (JSON/CSV) |

## Scan Profiles

| Profile | Use Case | Scans |
|---------|----------|-------|
| `baseline` | Daily lightweight inventory | Global package roots, toolchains, extensions |
| `project` | Project workspace inventory | Configured dev directories |
| `deep` | Incident response | Explicit root paths, full home directory |

## Development

### Prerequisites

- Python 3.11+
- Node.js 22+ (required by Vite 8; Node 20.19+ also works)
- Docker (recommended)

### Local Development (without Docker)

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
uvicorn bumblebee_gui.main:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

### Docker Development

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## Testing

```bash
# Backend unit + API tests (requires requirements-dev.txt)
cd backend
python -m pytest tests -q

# Frontend type-check + production build
cd frontend
npm run build
```

### CI pipeline

Every push and pull request runs four gates in `.github/workflows/ci.yml`:

1. **Socket supply-chain scan** — malicious-package / supply-chain vetting
2. **Gitleaks secret scan** — blocks committed credentials
3. **Dependency audits** — `pip-audit` + `npm audit` (hard gates; both clean)
4. **Build + tests** — `tsc` + Vite build + pytest

## Data Storage

Scan data is stored in `~/.bumblebee-gui/`:

```
~/.bumblebee-gui/
├── bumblebee-gui.db        # SQLite database
└── scans/
    ├── 2026-05-27_baseline_170000.ndjson
    └── ...
```

## Security

- **No hardcoded credentials** — All secrets are environment variables
- **Local only** — Runs on localhost, no external network calls
- **Read-only scanning** — Bumblebee only reads metadata, never modifies files
- **Supply-chain hardening** — Socket + gitleaks + `npm audit` / `pip-audit` gates in CI

## License

Apache 2.0 (same as Bumblebee)

## Acknowledgments

- [Bumblebee](https://github.com/perplexityai/bumblebee) by Perplexity AI
- [shadcn/ui](https://ui.shadcn.com/) for UI components
- [FastAPI](https://fastapi.tiangolo.com/) for the API framework
- [React](https://react.dev/) for the frontend framework
