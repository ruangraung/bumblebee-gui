// Download and CSV helpers shared by the pages that export a file.
//
// RFC 4180: a field is quoted only when it carries a delimiter, a quote, or a
// newline, and inner quotes are doubled.
const NEEDS_QUOTING = /[",\n]/

export function escapeCSV(value: string): string {
  if (!NEEDS_QUOTING.test(value)) return value
  return `"${value.replace(/"/g, '""')}"`
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
