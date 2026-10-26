import type { HostMountReport } from '@/lib/api'

export interface MountNotice {
  tone: 'info' | 'warning'
  text: string
}

// The scan form shows names, and a long list would push the rest of the form
// down for no gain.
const SHOWN = 8

// The last segment of a container path, for a list that shows names.
export function directoryName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path
}

function nameList(directories: string[]): string {
  const names = directories.slice(0, SHOWN).map(directoryName)
  const rest = directories.length - names.length
  return rest > 0 ? `${names.join(', ')}, and ${rest} more` : names.join(', ')
}

// What the scanner can read right now. An absent or empty mount is the state
// that produces a successful scan of nothing, so it gets the warning tone and
// the command that fixes it.
export function mountNotice(report: HostMountReport | null): MountNotice {
  if (!report) return { tone: 'info', text: '' }

  if (!report.mounted) {
    return {
      tone: 'warning',
      text: "No host directory is mounted, so a scan reads the scanner's own environment only. Start the stack with docker-compose.host-scan.yml and BUMBLEBEE_HOST_DIR pointing at a directory that exists on the host; the README has the command.",
    }
  }

  if (report.directories.length === 0) {
    // A mount holding only files is not empty. Saying "empty" sends the reader
    // looking for a BUMBLEBEE_HOST_DIR typo when the path is actually correct.
    if (report.file_count) {
      const files = report.file_count === 1 ? '1 file' : `${report.file_count} files`
      return {
        tone: 'info',
        text: `${report.path} is mounted read-only and holds ${files} but no subdirectories. Scan the mount itself, or point BUMBLEBEE_HOST_DIR at a directory that contains projects.`,
      }
    }
    return {
      tone: 'warning',
      text: `${report.path} is mounted but empty, so a scan of it reports no packages. BUMBLEBEE_HOST_DIR usually named a directory that does not exist on the host: Docker creates it and mounts it empty.`,
    }
  }

  return {
    tone: 'info',
    text: `Reads inside the scan container. ${report.path} is mounted read-only and holds: ${nameList(report.directories)}.`,
  }
}
