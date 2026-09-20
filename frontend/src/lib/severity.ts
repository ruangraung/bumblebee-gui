import type { FindingRecord } from '@/lib/api'

// Severity presentation and ordering in one place. The findings page used to
// keep a label map plus the same rank table in two separate spots.
const LABELS: Record<string, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
  info: 'INFO',
}

// Unknown severities rank last, so an unlisted catalog value can never sort
// above a real one.
const RANKS: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

const UNRANKED = 99

export function severityLabel(severity: string): string {
  return LABELS[severity.toLowerCase()] ?? severity.toUpperCase()
}

export function severityRank(severity: string): number {
  return RANKS[severity.toLowerCase()] ?? UNRANKED
}

export function bySeverity(a: FindingRecord, b: FindingRecord): number {
  return severityRank(a.severity) - severityRank(b.severity)
}

// The severities a scan actually contains, in rank order, for the filter menu.
export function severitiesPresent(findings: FindingRecord[]): string[] {
  const present = new Set(findings.map((finding) => finding.severity.toLowerCase()))
  return Array.from(present).sort((a, b) => severityRank(a) - severityRank(b))
}
