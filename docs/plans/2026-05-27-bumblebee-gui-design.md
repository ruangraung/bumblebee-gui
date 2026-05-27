# Bumblebee GUI — Design Document

**Date:** 2026-05-27
**Status:** Approved
**Purpose:** UI/UX design for Bumblebee GUI web interface

---

## Overview

Web GUI for Bumblebee, the open-source supply chain security scanner. Personal tool for daily use on Mac, with potential to open-source later.

**Primary workflow:** Run scans on demand, explore results visually.
**Secondary workflow:** Quick search when hearing about vulnerable packages.

---

## Page Structure & Navigation

**Layout:** Sidebar navigation with 5 pages.

```
┌─────────────────────────────────────────────────────────────┐
│ 🐝 Bumblebee GUI                    [🌙/☀️] [Settings ⚙️]  │
├────────────┬────────────────────────────────────────────────┤
│            │                                                │
│ Dashboard  │   (page content here)                         │
│ Scan       │                                                │
│ Results    │                                                │
│ Findings   │                                                │
│            │                                                │
│ ─────────  │                                                │
│ Settings   │                                                │
│            │                                                │
└────────────┴────────────────────────────────────────────────┘
```

| Page | Purpose |
|------|---------|
| **Dashboard** | Overview: last scan summary, package counts by ecosystem, quick actions |
| **Scan** | Configure and trigger scans |
| **Results** | Full package inventory table with filters, search, export |
| **Findings** | Exposure matches from catalog scans |
| **Settings** | Presets, defaults, theme, updates, data management |

**Navigation behavior:**
- Sidebar visible on all pages, active page highlighted
- Mobile: sidebar collapses to hamburger menu
- Settings accessible from sidebar and top-right gear icon

**Theme:** Dark/light toggle (system default + manual override)

---

## Dashboard Page

Landing page — "what's on my machine?" at a glance.

**Components:**
- **Stats cards:** Total packages, ecosystem count, findings count
- **Last scan banner:** When + profile, with "Scan Now" shortcut
- **Bar chart:** Package distribution by ecosystem (Recharts)
- **Recent scans table:** Last 5 scans, clickable to view results

**Empty state:** "No scans yet — run your first scan" with CTA

**Behavior:**
- "Scan Now" links to Scan page
- Click recent scan → Results page for that scan
- Findings card only shows if last scan had exposure catalog

---

## Scan Page

Configure and trigger scans — simple by default, powerful when needed.

**Features:**
- **Quick presets:** One-click cards for common configurations
- **Progressive disclosure:** Advanced options collapsed by default
- **Profile selector:** baseline / project / deep

**Expandable sections:**

### Ecosystems
All ecosystems Bumblebee supports:
- npm, PyPI, Go modules, RubyGems, Composer, MCP, Editor extensions, Browser extensions
- Select All / Clear All buttons

### Root Directories
- Add/remove directories
- `~` allowed but requires `deep` profile (auto-switch with warning)
- Required for `deep` profile, optional for others

### Exposure Catalog
- Upload JSON file or enter URL
- Findings only mode checkbox
- Max duration setting

### Advanced Options
- Save location
- Custom scan name

**Scan execution:**
- Progress bar on same page
- Status: "Scanning npm... (342 packages found)"
- Cancel button
- Auto-redirect to Results on completion

---

## Results Page

Main data exploration — table with filters, search, export.

**Table columns:**

| Column | Content |
|--------|---------|
| Package | Package name (bold) |
| Ecosystem | Color-coded badge |
| Version | Version string |
| Source | Where found (lockfile, metadata, etc.) |

**Filtering & sorting:**
- Search: fuzzy match on package name
- Ecosystem dropdown: filter to one or multiple
- Sort: Name A-Z/Z-A, Ecosystem, Version

**Pagination:** 50 packages per page

**Export options:**
- JSON: Full data as .json file
- CSV: Formatted spreadsheet
- Copy: Current view to clipboard

**Summary chart:** Mini bar chart, updates with filters

---

## Findings Page

Exposure matches — only relevant with exposure catalog scans.

**Severity levels:**
- 🔴 Critical / High
- 🟡 Medium
- 🔵 Low
- ⚪ Info

**Each finding shows:**
- Package name + version + ecosystem
- CVE or advisory ID
- Description (from catalog)
- Where found (root directory)

**Filtering:** By severity, ecosystem, search by name

**Empty states:**
- No findings: "No exposure matches in this scan"
- No catalog scan yet: "Findings come from scans with an exposure catalog"

---

## Settings Page

Configuration and management.

**Sections:**

### Appearance
Theme: Light / Dark / System

### Scan Presets
Save/edit/delete named configurations

**Preset editor:**
- Name, profile, ecosystems, roots, exposure catalog

### Default Paths
Project root for 'project' profile

### Data Management
- Scan history count + storage size
- Keep last N scans (auto-cleanup)
- Clear all data

### Updates
- Bumblebee GUI version + check GitHub button
- Bumblebee CLI version + check GitHub button
- Auto-check on startup option

**Update checking:** GitHub Releases API (not PyPI) — supply chain integrity

---

## Data Flow

```
Browser → FastAPI (API) → Bumblebee CLI (subprocess) → NDJSON output
                ↓
        SQLite (metadata) + NDJSON files (raw data)
```

**API endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/scans` | POST | Trigger scan |
| `/api/scans` | GET | List past scans |
| `/api/scans/{id}` | GET | Get scan details |
| `/api/scans/{id}` | DELETE | Delete scan |
| `/api/findings/{id}` | GET | Get findings for scan |
| `/api/export/{id}` | GET | Export JSON/CSV |
| `/api/settings` | GET/PUT | Settings |
| `/api/presets` | CRUD | Scan presets |

**Storage:**

```
~/.bumblebee-gui/
├── bumblebee-gui.db        # SQLite (~1MB) — scan metadata
├── scans/
│   ├── 2026-05-27_baseline_170000.ndjson
│   └── ...
└── config.json             # Presets, preferences
```

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Bumblebee binary not found | Error with download link |
| Scan fails | Show stderr message, suggest fixes |
| Scan timeout | Auto-cancel, show partial results |
| No packages found | Contextual message |
| No exposure catalog | Guide to run exposure scan |

---

## Distribution

**No PyPI** — GitHub Releases only (supply chain integrity)

**Install method:**
```bash
curl -sSL https://github.com/user/bumblebee-gui/releases/latest/download/install.sh | sh
```

**Update checking:** GitHub Releases API for both GUI and CLI

---

## MVP Priorities

| Feature | Priority |
|---------|----------|
| Dashboard | P0 |
| Scan Config | P0 |
| Scan Execution | P0 |
| Results Table | P0 |
| Findings View | P1 |
| Export | P1 |
| Scan History | P2 |
| Settings | P2 |
| Updates | P2 |

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Sidebar | Professional dashboard feel, scales well |
| Theme | Dark/Light toggle | User preference, shadcn/ui supports |
| Scan UI | Progressive disclosure | Simple by default, powerful when needed |
| Data persistence | Hybrid (SQLite + files) | Fast queries + raw data preservation |
| Distribution | GitHub Releases | Supply chain integrity, no PyPI |
| Update checking | GitHub API | Same trusted source as Bumblebee |

---

**Approved:** 2026-05-27
**Next:** Implementation planning
