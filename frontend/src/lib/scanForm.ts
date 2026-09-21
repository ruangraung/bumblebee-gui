import type { ScanRequest } from '@/lib/api'

export type Profile = ScanRequest['profile']

export interface Preset {
  label: string
  description: string
  profile: Profile
  ecosystems: string[]
  roots: string[]
}

// The scan form's own state, as the user has it on screen.
export interface ScanFormState {
  profile: Profile
  ecosystems: string[]
  roots: string[]
  exposureCatalog: string
  findingsOnly: boolean
  maxDuration: string
}

export const ALL_ECOSYSTEMS = [
  'npm', 'pypi', 'go', 'rubygems', 'packagist',
  'mcp', 'editor-extension', 'browser-extension',
]

export const DEFAULT_ECOSYSTEMS = ['npm', 'pypi']

export const PRESETS: Preset[] = [
  {
    label: 'Baseline',
    description: 'Common ecosystems, quick scan',
    profile: 'baseline',
    ecosystems: [...DEFAULT_ECOSYSTEMS],
    roots: [],
  },
  {
    label: 'Project',
    description: 'Dependencies under the mounted /host directory',
    profile: 'project',
    ecosystems: ['npm', 'pypi', 'go', 'rubygems'],
    roots: ['/host'],
  },
  {
    label: 'npm only',
    description: 'Only the npm ecosystem',
    profile: 'baseline',
    ecosystems: ['npm'],
    roots: [],
  },
  {
    label: 'Deep',
    description: 'All ecosystems, comprehensive',
    profile: 'deep',
    ecosystems: [...ALL_ECOSYSTEMS],
    roots: [],
  },
]

// The parts of a scan the warnings read. A preset satisfies this shape too, so
// a live form and a preset card answer to the same rules.
interface ProfileAndRoots {
  profile: Profile
  roots: string[]
}

// The bumblebee CLI rejects `deep` without explicit roots by design
// (incident-response profile refuses to auto-configure).
function deepWithoutRoots({ profile, roots }: ProfileAndRoots): boolean {
  return profile === 'deep' && roots.length === 0
}

function usesHomeRoot(roots: string[]): boolean {
  return roots.some((root) => root === '~' || root.startsWith('~/'))
}

export interface ScanFormWarnings {
  homeRoot: boolean
  deepWithoutRoots: boolean
}

export function scanFormWarnings(form: ScanFormState): ScanFormWarnings {
  return {
    homeRoot: usesHomeRoot(form.roots) && form.profile !== 'deep',
    deepWithoutRoots: deepWithoutRoots(form),
  }
}

// A preset that scans deep without roots lands the user on the roots section,
// where the missing input is.
export function presetOpensRoots(preset: Preset): boolean {
  return deepWithoutRoots(preset)
}

export function withEcosystemToggled(ecosystems: string[], eco: string): string[] {
  if (ecosystems.includes(eco)) return ecosystems.filter((e) => e !== eco)
  return [...ecosystems, eco]
}

// Returns null when the entry would add nothing: blank, or already listed.
export function addedRoot(roots: string[], raw: string): string[] | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (roots.includes(trimmed)) return null
  return [...roots, trimmed]
}

export interface ScanFormProblem {
  message: string
  revealRoots: boolean
}

export function validateScanForm(form: ScanFormState): ScanFormProblem | null {
  if (form.ecosystems.length === 0) {
    return { message: 'Select at least one ecosystem.', revealRoots: false }
  }
  if (deepWithoutRoots(form)) {
    return {
      message:
        'The deep profile requires at least one root directory. Add one under "Root directories".',
      revealRoots: true,
    }
  }
  return null
}

// Only what the user set is sent: an empty root list and an empty catalog path
// are omitted so the CLI falls back to its own defaults.
export function buildScanRequest(form: ScanFormState): ScanRequest {
  return {
    profile: form.profile,
    ecosystems: form.ecosystems,
    roots: form.roots.length > 0 ? form.roots : undefined,
    exposure_catalog: form.exposureCatalog || undefined,
    findings_only: form.findingsOnly,
    max_duration: form.maxDuration,
  }
}
