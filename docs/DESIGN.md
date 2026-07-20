---
version: alpha
name: Bumblebee GUI
description: Supply chain security scanner dashboard — dark-mode-first, data-dense, clinical precision with warm amber accents.
colors:
  primary: "#1A2340"
  primary-light: "#F8FAFC"
  secondary: "#F1F5F9"
  secondary-dark: "#1E293B"
  destructive: "#DC2626"
  destructive-dark: "#991B1B"
  muted: "#F1F5F9"
  muted-dark: "#334155"
  border: "#E2E8F0"
  border-dark: "#1E293B"
  background: "#FFFFFF"
  background-dark: "#0F172A"
  foreground: "#0F172A"
  foreground-dark: "#F8FAFC"
  accent-amber: "#F59E0B"
  accent-blue: "#3B82F6"
  accent-cyan: "#06B6D4"
  accent-emerald: "#10B981"
  accent-violet: "#8B5CF6"
  accent-pink: "#EC4899"
  accent-red: "#EF4444"
  on-primary: "#FFFFFF"
  on-destructive: "#FFFFFF"
typography:
  h1:
    fontFamily: system-ui, -apple-system, sans-serif
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.2
  h2:
    fontFamily: system-ui, -apple-system, sans-serif
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.3
  body-md:
    fontFamily: system-ui, -apple-system, sans-serif
    fontSize: 1rem
    lineHeight: 1.5
  body-sm:
    fontFamily: system-ui, -apple-system, sans-serif
    fontSize: 0.875rem
    lineHeight: 1.5
  label-caps:
    fontFamily: system-ui, -apple-system, sans-serif
    fontSize: 0.75rem
    fontWeight: 600
    letterSpacing: "0.08em"
    textTransform: uppercase
  stat-value:
    fontFamily: system-ui, -apple-system, sans-serif
    fontSize: 1.875rem
    fontWeight: 700
    lineHeight: 1.1
rounded:
  sm: 4px
  md: 8px
  lg: 8px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
components:
  sidebar:
    width: 256px
    backgroundColor: "{colors.background}"
    borderRight: "1px solid {colors.border}"
    padding: 12px
  sidebar-nav-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  sidebar-nav-inactive:
    textColor: "#64748B"
    hoverBackground: "{colors.secondary}"
  header:
    height: 56px
    borderBottom: "1px solid {colors.border}"
    padding: "0 24px"
  card:
    backgroundColor: "{colors.background}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.md}"
    padding: 24px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    fontSize: 0.875rem
    fontWeight: 500
  button-primary-hover:
    opacity: 0.9
  button-ghost:
    hoverBackground: "{colors.secondary}"
  stats-card:
    backgroundColor: "{colors.background}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.md}"
    padding: 24px
    titleFontSize: 0.875rem
    titleColor: "#64748B"
    valueFontSize: 1.875rem
    valueFontWeight: 700
  severity-badge-critical:
    backgroundColor: "#FEE2E2"
    textColor: "#991B1B"
  severity-badge-high:
    backgroundColor: "#FFEDD5"
    textColor: "#9A3412"
  severity-badge-medium:
    backgroundColor: "#FEF9C3"
    textColor: "#854D0E"
  severity-badge-low:
    backgroundColor: "#DBEAFE"
    textColor: "#1E40AF"
  severity-badge-info:
    backgroundColor: "#F3F4F6"
    textColor: "#374151"
  ecosystem-badge-npm:
    backgroundColor: "#FEF3C7"
    textColor: "#92400E"
  ecosystem-badge-pypi:
    backgroundColor: "#DBEAFE"
    textColor: "#1E40AF"
  ecosystem-badge-go:
    backgroundColor: "#CFFAFE"
    textColor: "#155E75"
  ecosystem-badge-rubygems:
    backgroundColor: "#FCE7F3"
    textColor: "#9D174D"
  ecosystem-badge-packagist:
    backgroundColor: "#F3E8FF"
    textColor: "#6B21A8"
  ecosystem-badge-default:
    backgroundColor: "#F3F4F6"
    textColor: "#374151"
---

## Overview

Bumblebee GUI is a supply chain security scanner dashboard. The visual identity
is clinical and data-dense — Think terminal precision meets modern web UI.
Dark-mode-first design philosophy. The UI prioritizes scannability and data
density over decorative elements. Warm amber is used sparingly as the primary
accent for interactive elements, with a muted navy as the base palette.

## Colors

- **Primary (#1A2340):** Dark navy — used for active nav states, primary buttons,
  and high-emphasis actions. In dark mode, inverts to near-white (#F8FAFC).
- **Secondary (#F1F5F9):** Light blue-gray — hover states, muted backgrounds,
  secondary surfaces. In dark mode: #1E293B.
- **Destructive (#DC2626):** Red — error states, danger actions, critical severity.
  In dark mode: #991B1B.
- **Muted (#F1F5F9):** Background for disabled elements, placeholder text.
  Foreground: #64748B (light), #94A3B8 (dark).
- **Border (#E2E8F0):** Subtle separators. In dark mode: #1E293B.
- **Ecosystem colors:** npm=amber, pypi=blue, go=cyan, rubygems=pink,
  packagist=violet. Used for badges and chart bars.
- **Severity colors:** critical=red, high=orange, medium=yellow, low=blue,
  info=gray. Used for left-border accents and badges.

## Typography

System fonts only (system-ui, -apple-system, sans-serif). No custom web fonts.
Hierarchy is carried by weight and size, not font family. The `label-caps`
style uses uppercase tracking for section headers (Appearance, Scan Presets).

- **Page titles (h1):** 24px, bold (700)
- **Section titles (h2):** 18px, semibold (600)
- **Body:** 16px, regular (400)
- **Small text:** 14px, regular — used for nav items, table cells, descriptions
- **Stat values:** 30px, bold — used in StatsCard for big numbers

## Layout

Fixed sidebar (256px) on the left, full-height. Main content area is flex-1 with
vertical scrolling. Header bar (56px) at top of content area with theme toggle
aligned right. Content padding: 24px on all sides.

**Responsive breakpoints (inherited from Tailwind):**
- sm: 640px — grid switches to 2-column
- lg: 1024px — grid switches to 3-column

**Dashboard grid:** 2 columns on mobile, 3 columns on desktop (StatsCards).

## Elevation & Depth

No shadows by default. Depth is communicated through borders and background
contrast. Cards use `1px solid {border}` on white background. Active states
use background color changes, not elevation changes.

## Shapes

Rounded corners are modest — `md` (8px) on cards, buttons, badges, and nav items.
No `lg` or `xl` rounding. Full rounding reserved for status dots only.

## Components

- **Sidebar:** Fixed left panel, full height, border-right. Logo + Bug icon at
  top, nav items in middle, Settings at bottom. Active item gets primary bg.
- **StatsCard:** Border card with icon, title (muted), big value, optional
  description. Used on Dashboard for metrics.
- **Button:** 6 variants (default/primary, destructive, outline, secondary,
  ghost, link). 4 sizes (default, sm, lg, icon). Primary = dark bg, white text.
- **EcosystemChart:** Recharts BarChart, 100% width, 300px height. Bar color
  uses primary. Rounded top corners on bars.
- **ThemeToggle:** Ghost button with Sun/Moon icon. 20px icon size.
- **CollapsibleSection:** Border container with chevron toggle. Used on Scan page
  for Ecosystems, Root Directories, Exposure Catalog.
- **NavLink:** Sidebar navigation items. Flex row with icon (20px) + label.
  Active: primary bg + white text. Inactive: muted text + hover accent.
- **Table:** Simple HTML table with border-bottom rows. Muted header row.
  Hover state on rows. Used for Recent Scans and Results.
- **Badge:** Small pill for ecosystem and severity labels. Color-coded by type.

## Do's and Don'ts

- **Do** keep the UI data-dense — this is a security tool, not a marketing site.
- **Do** use severity colors consistently — left-border accents on findings,
  badge colors on scan results.
- **Do** default to dark mode — it's the primary use case for security dashboards.
- **Do** use system fonts — no need to load custom fonts, keep it fast.
- **Don't** add shadows or gradients — the design is flat and clinical.
- **Don't** use decorative illustrations — data and icons communicate everything.
- **Don't** break the 256px sidebar — it's fixed, not collapsible.
- **Don't** introduce new colors outside the ecosystem/severity palette.
- **Don't** use `cargo`, `maven`, `nuget`, `cocoapods` — they're not real
  bumblebee ecosystems. Correct list: npm, pypi, go, rubygems, packagist,
  mcp, editor-extension, browser-extension.
