# Bumblebee GUI

A web interface for [Bumblebee](https://github.com/perplexityai/bumblebee), the open-source supply chain security scanner from Perplexity AI.

## Why?

Bumblebee is a powerful CLI tool for scanning local filesystems for package metadata across multiple ecosystems (npm, PyPI, Go, Ruby, etc.). But CLI tools aren't for everyone. **Bumblebee GUI** wraps it in a clean web interface so you can:

- 🔍 Run scans with point-and-click
- 📊 Visualize findings with charts and tables
- 🔎 Filter and search results
- 📥 Export data as JSON/CSV

## Quick Start

```bash
# Install
pip install bumblebee-gui

# Run
bumblebee-gui

# Opens browser at http://localhost:8080
```

## Development

### Prerequisites

- Python 3.10+
- Node.js 18+
- Bumblebee binary (downloaded automatically or place in `backend/bin/`)

### Setup

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install

# Run both
cd .. && docker compose up
# OR run separately:
# Terminal 1: cd backend && uvicorn main:app --reload --port 8000
# Terminal 2: cd frontend && npm run dev
```

### Project Structure

```
bumblebee-gui/
├── backend/           # Python FastAPI server
│   ├── main.py        # API endpoints
│   ├── scanner.py     # Bumblebee CLI wrapper
│   ├── models.py      # Data models
│   └── requirements.txt
├── frontend/          # React + TypeScript + TailwindCSS
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── lib/
│   └── package.json
├── pyproject.toml     # Python packaging
└── docker-compose.yml # Development environment
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Browser UI    │────▶│  Python API     │────▶│   Bumblebee     │
│   (React/TS)    │◀────│  (FastAPI)      │◀────│   CLI Binary    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## License

Apache 2.0 (same as Bumblebee)
