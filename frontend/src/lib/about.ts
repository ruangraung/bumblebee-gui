import type { HostMountReport, ScannerInfo } from '@/lib/api'

// The About panel states what this install is, from the API only. A fact that
// could not be read says so rather than being filled in with a guess.

export function scannerLine(info: ScannerInfo | null): string {
  if (!info) return 'reading it'
  if (info.version && info.commit) return `${info.version} (${info.commit})`
  return info.version ?? info.error ?? 'not reported'
}

// The path and how much is in it. Which directories those are is already on the
// scan form, where a person is choosing one, so this stays short.
export function mountLine(report: HostMountReport | null): string {
  if (!report) return 'reading it'
  if (!report.mounted) return 'nothing mounted'
  const count = report.directories.length
  return `${report.path}, ${count} ${count === 1 ? 'directory' : 'directories'}`
}
