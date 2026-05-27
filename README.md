# Bumblebee GUI

A web interface for [Bumblebee](https://github.com/perplexityai/bumblebee), the open-source supply chain security scanner from Perplexity AI.

## Why?

Bumblebee is a powerful CLI tool for scanning local filesystems for package metadata across multiple ecosystems (npm, PyPI, Go, Ruby, etc.). But CLI tools aren't for everyone. **Bumblebee GUI** wraps it in a clean web interface so you can:

- 🔍 Run scans with point-and-click
- 📊 Visualize findings with charts and tables
- 🔎 Filter and search results
- 📥 Export data as JSON/CSV
- 🌙 Dark/light theme support

## Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Overview of packages by ecosystem, recent scans |
| **Scan Configuration** | Select profile, ecosystems, root directories |
| **Scan Execution** | Trigger scans, view progress |
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
4. Click **Start Scan**
5. View results in the Dashboard or Results page

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Browser UI    │────▶│  Python API     │────▶│   Bumblebee     │
│   (React/TS)    │◀────│  (FastAPI)      │◀────│   CLI Binary    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Port 5173              Port 8001              Subprocess
```

### Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 18 + TypeScript | UI framework |
| **Styling** | TailwindCSS + shadcn/ui | Styling and components |
| **Charts** | Recharts | Data visualization |
| **State** | Zustand | State management |
| **Backend** | Python 3.11 + FastAPI | API server |
| **Database** | SQLite | Scan metadata storage |
| **Scanner** | Bumblebee CLI | Package scanning |

## Project Structure

```
bumblebee-gui/
├── backend/
│   ├── bumblebee_gui/
│   │   ├── main.py          # FastAPI app + API endpoints
│   │   ├── scanner.py       # Bumblebee CLI wrapper
│   │   ├── database.py      # SQLite operations
│   │   └── models.py        # Pydantic models
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── lib/             # Utilities, API client
│   │   └── stores/          # Zustand stores
│   └── package.json
├── docker-compose.yml       # Development environment
├── Dockerfile.backend       # Backend container
├── Dockerfile.frontend      # Frontend container
└── install.sh               # Installation script
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/scans` | Trigger a scan |
| `GET` | `/api/scans` | List recent scans |
| `GET` | `/api/scans/{id}` | Get scan details |
| `DELETE` | `/api/scans/{id}` | Delete a scan |
| `GET` | `/api/scans/{id}/packages` | Get packages from scan |
| `GET` | `/api/scans/{id}/findings` | Get findings from scan |
| `GET` | `/api/scans/{id}/export` | Export scan data |

## Scan Profiles

| Profile | Use Case | Scans |
|---------|----------|-------|
| `baseline` | Daily lightweight inventory | Global package roots, toolchains, extensions |
| `project` | Project workspace inventory | Configured dev directories |
| `deep` | Incident response | Explicit root paths, full home directory |

## Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker (recommended)

### Local Development (without Docker)

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
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
- **No PyPI** — Distribution via GitHub Releases only
- **Local only** — Runs on localhost, no external network calls
- **Read-only scanning** — Bumblebee only reads metadata, never modifies files

## License

Apache 2.0 (same as Bumblebee)

## Acknowledgments

- [Bumblebee](https://github.com/perplexityai/bumblebee) by Perplexity AI
- [shadcn/ui](https://ui.shadcn.com/) for UI components
- [FastAPI](https://fastapi.tiangolo.com/) for the API framework
- [React](https://react.dev/) for the frontend framework
