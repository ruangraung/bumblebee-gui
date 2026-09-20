// Download and CSV helpers shared by the pages that export a file.
//
// RFC 4180: a field is quoted only when it carries a delimiter, a quote, or a
// newline, and inner quotes are doubled.
const NEEDS_QUOTING = /[",\n]/

// RFC 4180 says nothing about how a spreadsheet reads a field once it is
// parsed, and Excel, Sheets and LibreOffice run a cell that begins with =, + or
// - as a formula. A package name is attacker-controlled data, so a scan result
// named `=cmd|'/c calc'!A1` would execute when the export is opened. A leading
// tab or carriage return can shift the row for the same reason. The apostrophe
// is the spreadsheet's own "read this cell as text" marker.
const FORMULA_LEAD = /^[=+\-\t\r]/

// An npm scope is a name rather than a call, so `@types/node` is left alone
// while `@SUM(1+1)` is not.
const AT_NOT_SCOPE = /^@(?![\w.-]+\/)/

export function sanitizeCell(value: string): string {
  if (value.startsWith('@')) return AT_NOT_SCOPE.test(value) ? `'${value}` : value
  if (FORMULA_LEAD.test(value)) return `'${value}`
  return value
}

export function escapeCSV(value: string): string {
  const cell = sanitizeCell(value)
  if (!NEEDS_QUOTING.test(cell)) return cell
  return `"${cell.replace(/"/g, '""')}"`
}

// Header first, then one line per row. Every cell is escaped, so callers pass
// raw values and never build delimiters themselves.
export function buildCSV(
  columns: readonly string[],
  rows: readonly (string | undefined)[][],
): string {
  const lines = rows.map((row) => row.map((cell) => escapeCSV(cell ?? '')).join(','))
  return [columns.join(','), ...lines].join('\n')
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
