# Bumblebee GUI — Implementation Plan v2

**Date:** 2026-05-28
**Sources:** DESIGN.md, refactor-plan.md, exposure catalogs analysis
**Status:** Ready for execution

---

## Table of Contents

1. [Summary](#summary)
2. [Phase 1: P0 Bug Fixes](#phase-1-p0-bug-fixes)
3. [Phase 2: Playwright Setup](#phase-2-playwright-setup)
4. [Phase 3: UI Redesign to DESIGN.md](#phase-3-ui-redesign-to-designdmd)
5. [Phase 4: Exposure Catalogs](#phase-4-exposure-catalogs)
6. [Phase 5: Architecture Improvements](#phase-5-architecture-improvements)
7. [Phase 6: Polish & Verification](#phase-6-polish--verification)
8. [Execution Strategy](#execution-strategy)

---

## Summary

This plan combines three sources:
- **DESIGN.md** — Visual spec (colors, typography, components, layout)
- **refactor-plan.md** — Bugs, architecture issues, missing features
- **Exposure catalogs** — 8 threat intel files from Perplexity's repo

**Key insight:** We fix bugs first (P0), then redesign UI to match DESIGN.md, then add features. This prevents fixing bugs in UI we're about to replace.

---

## Phase 1: P0 Bug Fixes

**Goal:** Make the app produce correct results.

### 1.1 Fix Backend Models

**File:** `backend/bumblebee_gui/models.py`

| Model | Current (Wrong) | Correct |
|-------|-----------------|---------|
| `PackageRecord.source` | `source` field | `source_type`, `source_file`, `project_path`, `package_manager`, `confidence`, `has_lifecycle_scripts` |
| `FindingRecord` | `cve`, `description`, `found_in` | `catalog_id`, `catalog_name`, `evidence`, `source_file`, `source_type`, `root_kind`, `project_path`, `confidence` |

### 1.2 Fix Scanner Field Mapping

**File:** `backend/bumblebee_gui/scanner.py`

- `get_scan_packages()` — Map `package_name` (not `name`), add new fields
- `get_scan_findings()` — Map `catalog_id`, `catalog_name`, `evidence` (not `cve`, `description`, `found_in`)

### 1.3 Fix Ecosystem List

**File:** `frontend/src/pages/Scan.tsx`

| Current (Wrong) | Correct |
|-----------------|---------|
| `cargo`, `maven`, `nuget`, `cocoapods` | `packagist`, `mcp`, `editor-extension`, `browser-extension` |

### 1.4 Fix Frontend Types

**File:** `frontend/src/lib/api.ts`

Align TypeScript interfaces with corrected Python models.

### 1.5 Fix Findings Page

**File:** `frontend/src/pages/Findings.tsx`

- `found_in` → `source_file`
- Add `catalog_name`, `evidence` display

### 1.6 Fix Results Page

**File:** `frontend/src/pages/Results.tsx`

- Add columns: `source_type`, `project_path`, `confidence`
- Update CSV export

**Verification:** Playwright screenshots + API tests

---

## Phase 2: Playwright Setup

**Goal:** Verify UI before pushing.

### 2.1 Add Playwright to Docker

**File:** `Dockerfile.frontend`

```dockerfile
RUN npx playwright install --with-deps chromium
```

### 2.2 Create Test Scripts

**File:** `frontend/tests/smoke.spec.ts`

```typescript
test('dashboard loads', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await expect(page.locator('h2')).toContainText('Dashboard')
})

test('scan page renders', async ({ page }) => {
  await page.goto('http://localhost:5173/scan')
  await expect(page.locator('text=Baseline')).toBeVisible()
})

test('api health check', async ({ request }) => {
  const response = await request.get('http://localhost:8001/api/health')
  expect(response.ok()).toBeTruthy()
})
```

### 2.3 Screenshot Function

**File:** `frontend/tests/screenshot.ts`

```typescript
import { test } from '@playwright/test'

export async function takeScreenshot(page, name) {
  await page.screenshot({ path: `/tmp/screenshots/${name}.png`, fullPage: true })
}
```

**Verification:** Run tests, verify screenshots

---

## Phase 3: UI Redesign to DESIGN.md

**Goal:** Match the visual spec exactly.

### 3.1 Update CSS Variables

**File:** `frontend/src/index.css`

Replace current variables with DESIGN.md tokens:

```css
:root {
  --background: 0 0% 100%;          /* #FFFFFF */
  --foreground: 222 47% 11%;        /* #0F172A */
  --primary: 222 47% 11%;           /* #1A2340 */
  --primary-foreground: 0 0% 100%;  /* #FFFFFF */
  --secondary: 210 40% 96%;         /* #F1F5F9 */
  --destructive: 0 72% 51%;        /* #DC2626 */
  --muted: 210 40% 96%;            /* #F1F5F9 */
  --border: 214 32% 91%;           /* #E2E8F0 */
  --accent-amber: 38 92% 50%;      /* #F59E0B */
  /* ... etc */
}

.dark {
  --background: 222 47% 11%;        /* #0F172A */
  --foreground: 210 40% 98%;        /* #F8FAFC */
  --primary: 210 40% 98%;           /* #F8FAFC */
  --primary-foreground: 222 47% 11%; /* #1A2340 */
  --secondary: 215 32% 18%;        /* #1E293B */
  --destructive: 0 68% 36%;        /* #991B1B */
  --border: 215 32% 18%;           /* #1E293B */
  /* ... etc */
}
```

### 3.2 Update Tailwind Config

**File:** `frontend/tailwind.config.js`

Add ecosystem and severity colors:

```javascript
colors: {
  'ecosystem-npm': { bg: '#FEF3C7', text: '#92400E' },
  'ecosystem-pypi': { bg: '#DBEAFE', text: '#1E40AF' },
  'ecosystem-go': { bg: '#CFFAFE', text: '#155E75' },
  'ecosystem-rubygems': { bg: '#FCE7F3', text: '#9D174D' },
  'ecosystem-packagist': { bg: '#F3E8FF', text: '#6B21A8' },
  'severity-critical': { bg: '#FEE2E2', text: '#991B1B' },
  'severity-high': { bg: '#FFEDD5', text: '#9A3412' },
  'severity-medium': { bg: '#FEF9C3', text: '#854D0E' },
  'severity-low': { bg: '#DBEAFE', text: '#1E40AF' },
  'severity-info': { bg: '#F3F4F6', text: '#374151' },
}
```

### 3.3 Update Component Styles

| Component | Changes |
|-----------|---------|
| Sidebar | 256px fixed, border-right, primary bg for active |
| StatsCard | Border card, muted title, big value |
| Button | 6 variants, primary = dark bg |
| Badge | Ecosystem + severity colors |
| Table | Border-bottom rows, muted header |
| Card | Border, no shadow, 8px radius |

### 3.4 Create Badge Components

**File:** `frontend/src/components/ui/badge.tsx`

```tsx
// EcosystemBadge: color-coded by ecosystem
// SeverityBadge: color-coded by severity
```

### 3.5 Update Page Layouts

| Page | Changes |
|------|---------|
| Dashboard | 2-col mobile, 3-col desktop grid |
| Scan | Collapsible sections with proper styling |
| Results | Table with new columns, badge rendering |
| Findings | Severity left-border accent |
| Settings | Label-caps section headers |

**Verification:** Playwright screenshots comparing to DESIGN.md spec

---

## Phase 4: Exposure Catalogs

**Goal:** Full catalog management.

### 4.1 Create Catalog Manager

**File:** `backend/bumblebee_gui/catalogs.py`

```python
KNOWN_CATALOGS = [
    {"id": "antv-mini-shai-hulud", "name": "ANTV Mini Shai Hulud", "url": "..."},
    {"id": "gemstuffer", "name": "Gemstuffer", "url": "..."},
    {"id": "laravel-lang-2026-05-23", "name": "Laravel Lang", "url": "..."},
    {"id": "mini-shai-hulud", "name": "Mini Shai Hulud", "url": "..."},
    {"id": "node-ipc-credential-stealer", "name": "Node IPC Credential Stealer", "url": "..."},
    {"id": "nx-console-vscode-2026-05-18", "name": "NX Console VSCode", "url": "..."},
    {"id": "shopsprint-decimal-typosquat", "name": "ShopSprint Decimal Typosquat", "url": "..."},
    {"id": "trapdoor-crypto-stealer", "name": "Trapdoor Crypto Stealer", "url": "..."},
]
```

### 4.2 Add Catalog API Endpoints

**File:** `backend/bumblebee_gui/main.py`

```
GET  /api/catalogs              — List all catalogs with status
POST /api/catalogs/{id}/download — Download specific catalog
POST /api/catalogs/download-all  — Download all catalogs
```

### 4.3 Update Scan Page

**File:** `frontend/src/pages/Scan.tsx`

Replace raw text input with catalog picker:
- List all known catalogs
- Show download status, entry count
- Download button for missing catalogs
- Radio selection for scan

### 4.4 Update Scan Request

**File:** `backend/bumblebee_gui/scanner.py`

When catalog selected, use `--exposure-catalog <catalog_dir>` flag.

**Verification:** Download a catalog, run exposure scan, verify findings

---

## Phase 5: Architecture Improvements

**Goal:** Better UX and performance.

### 5.1 Scan Progress via SSE

**File:** `backend/bumblebee_gui/main.py`

Replace blocking `POST /api/scans` with SSE streaming:
- Stream package/finding counts in real-time
- Show progress on frontend
- Handle errors gracefully

### 5.2 Frontend Progress Component

**File:** `frontend/src/components/ScanProgress.tsx`

```tsx
// Real-time progress display
// Package count, finding count, elapsed time
// Status: running/completed/failed
```

### 5.3 Lazy NDJSON Loading

**File:** `backend/bumblebee_gui/scanner.py`

Add pagination to `get_scan_packages()`:
- `offset`, `limit` parameters
- Server-side filtering (ecosystem, search)
- Return total count

### 5.4 Bumblebee Version Check

**File:** `backend/bumblebee_gui/main.py`

On startup:
- Check if bumblebee binary exists
- Log version info
- Add to health endpoint

### 5.5 CORS Restriction

**File:** `backend/bumblebee_gui/main.py`

Change from `allow_origins=["*"]` to localhost-only.

**Verification:** Playwright tests for progress UI, API tests for pagination

---

## Phase 6: Polish & Verification

**Goal:** Production-ready.

### 6.1 Error Boundaries

**File:** `frontend/src/components/ErrorBoundary.tsx`

Catch React errors gracefully.

### 6.2 Loading States

All pages should show proper loading indicators.

### 6.3 Empty States

- Dashboard: "No scans yet" with CTA
- Results: "No packages found"
- Findings: "No exposure scans yet"

### 6.4 README Update

Reflect all changes, correct ecosystem list, new features.

### 6.5 Final Playwright Verification

Screenshot all pages, all states (loading, empty, error, success).

**Verification:** Full Playwright test suite, Mac verification

---

## Execution Strategy

### Order of Operations

```
Phase 1: P0 Bug Fixes (critical — app is broken)
    ↓
Phase 2: Playwright Setup (verify before pushing)
    ↓
Phase 3: UI Redesign (match DESIGN.md)
    ↓
Phase 4: Exposure Catalogs (core feature)
    ↓
Phase 5: Architecture (SSE, pagination)
    ↓
Phase 6: Polish (error handling, docs)
```

### Why This Order

1. **P0 bugs first** — App produces wrong results without these
2. **Playwright second** — Verify all subsequent changes
3. **UI redesign third** — Redesign on correct data, not broken data
4. **Catalogs fourth** — New feature on solid foundation
5. **Architecture fifth** — Improve UX after core works
6. **Polish last** — Final pass before release

### Verification Strategy

| Phase | Verification Method |
|-------|---------------------|
| P0 bugs | Playwright + API tests |
| Playwright setup | Self-test (tests pass) |
| UI redesign | Screenshot comparison to DESIGN.md |
| Catalogs | Download catalog, run scan, verify findings |
| Architecture | Playwright progress tests |
| Polish | Full test suite + Mac verification |

### Git Strategy

- **Branch:** `main` (we're the only developers)
- **Commits:** One per logical change
- **Push:** Only after Playwright verification
- **Tag:** `v0.2.0` after all phases complete

---

## Files to Modify

### Backend

| File | Phase | Changes |
|------|-------|---------|
| `models.py` | P0 | Fix PackageRecord, FindingRecord |
| `scanner.py` | P0+P1+P5 | Fix field mapping, add pagination, add catalog support |
| `main.py` | P1+P5 | Add SSE, catalog endpoints, version check, CORS |
| `catalogs.py` | P4 | NEW — catalog management |

### Frontend

| File | Phase | Changes |
|------|-------|---------|
| `index.css` | P3 | DESIGN.md color tokens |
| `tailwind.config.js` | P3 | Ecosystem/severity colors |
| `Scan.tsx` | P0+P3+P4 | Fix ecosystems, redesign, catalog picker |
| `Findings.tsx` | P0+P3 | Fix fields, redesign |
| `Results.tsx` | P0+P3 | Fix fields, add columns, redesign |
| `api.ts` | P0+P5 | Fix types, add SSE, add catalog API |
| `scanStore.ts` | P5 | Add progress state |
| `ScanProgress.tsx` | P5 | NEW — progress component |
| `badge.tsx` | P3 | NEW — ecosystem/severity badges |
| `ErrorBoundary.tsx` | P6 | NEW — error handling |

### Infrastructure

| File | Phase | Changes |
|------|-------|---------|
| `Dockerfile.frontend` | P2 | Add Playwright |
| `README.md` | P6 | Update docs |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| SSE breaks existing API | Keep POST endpoint, add SSE as new endpoint |
| Playwright adds complexity | Run in Docker only, minimal tests |
| DESIGN.md conflicts with shadcn | Override shadcn styles, don't fight them |
| Catalog download fails | Graceful fallback, show error |

---

## Success Criteria

- [ ] All P0 bugs fixed (ecosystems, models, field mapping)
- [ ] Playwright tests pass on VPS
- [ ] UI matches DESIGN.md spec
- [ ] Exposure catalogs download and work
- [ ] Scan progress shows in real-time
- [ ] Mac verification passes first time

---

*This plan is the execution guide. Update as work progresses.*
