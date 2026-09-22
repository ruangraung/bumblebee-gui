import { ALL_ECOSYSTEMS, PRESETS } from '@/lib/scanForm'
import type { Profile, ScanFormState } from '@/lib/scanForm'

// What the form shows, including which preset card is selected: null once the
// user edits a field by hand.
export interface RememberedForm {
  form: ScanFormState
  activePreset: string | null
}

// Stored as one flat record of the form's fields plus `activePreset`, so the
// payload stays readable when inspected in a browser's storage pane.
const STORAGE_KEY = 'bumblebee.scan-form'

const PROFILES: string[] = ['baseline', 'project', 'deep']
const PRESET_LABELS = PRESETS.map((preset) => preset.label)

function isProfile(value: unknown): value is Profile {
  return typeof value === 'string' && PROFILES.includes(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

// A list of strings, trimmed and deduplicated. Null when the entry is not a list
// of strings, or holds a value this build does not know: an unrecognised
// ecosystem would be handed to the CLI as written.
function stringList(value: unknown, known?: string[]): string[] | null {
  if (!Array.isArray(value)) return null
  if (value.some((item) => typeof item !== 'string')) return null
  const trimmed = value.map((item) => item.trim()).filter(Boolean)
  const unique = [...new Set(trimmed)]
  if (known && unique.some((item) => !known.includes(item))) return null
  return unique
}

// The stored payload as a record, or null when the store holds nothing usable.
function storedEntry(): Record<string, unknown> | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

// Null when a field a scan cannot run without is missing or untrustworthy. The
// rest fall back to the form's own defaults.
function formFromEntry(entry: Record<string, unknown>): ScanFormState | null {
  const profile = isProfile(entry.profile) ? entry.profile : null
  const ecosystems = stringList(entry.ecosystems, ALL_ECOSYSTEMS)
  const roots = stringList(entry.roots)
  if (!profile) return null
  if (!ecosystems || ecosystems.length === 0) return null
  if (!roots) return null
  return {
    profile,
    ecosystems,
    roots,
    exposureCatalog: text(entry.exposureCatalog),
    findingsOnly: entry.findingsOnly === true,
    maxDuration: text(entry.maxDuration),
  }
}

function presetFromEntry(entry: Record<string, unknown>): string | null {
  const label = entry.activePreset
  if (typeof label !== 'string') return null
  return PRESET_LABELS.includes(label) ? label : null
}

// The remembered form, or null when there is nothing worth restoring: absent,
// unparseable, or missing the parts a scan needs.
export function readFormMemory(): RememberedForm | null {
  const entry = storedEntry()
  if (!entry) return null
  const form = formFromEntry(entry)
  if (!form) return null
  return { form, activePreset: presetFromEntry(entry) }
}

// A store that is blocked or full costs the convenience only, so a failure here
// is not an error the user needs to see.
export function writeFormMemory(remembered: RememberedForm): void {
  if (typeof localStorage === 'undefined') return
  try {
    const entry = { ...remembered.form, activePreset: remembered.activePreset }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry))
  } catch {
    // Private browsing and a full quota both land here.
  }
}
