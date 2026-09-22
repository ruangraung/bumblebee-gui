import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScanStore } from '@/stores/scanStore'
import { readFormMemory, writeFormMemory } from '@/lib/formMemory'
import {
  ALL_ECOSYSTEMS,
  DEFAULT_ECOSYSTEMS,
  addedRoot,
  buildScanRequest,
  presetOpensRoots,
  scanFormWarnings,
  validateScanForm,
  withEcosystemToggled,
} from '@/lib/scanForm'
import type { Preset, Profile, ScanFormState, ScanFormProblem } from '@/lib/scanForm'

export type FormSection = 'ecosystems' | 'roots' | 'exposure'

// The scan form: the values the user has entered, which sections are open, and
// the three ways they change the form (a preset, a field, or the start button).
// Submitting keeps the page's behaviour: the first problem found blocks the
// scan and an API failure is left to the store to report. A form that started a
// scan is remembered for the next visit.
export function useScanForm() {
  const navigate = useNavigate()
  const { createScan, loading, error: storeError } = useScanStore()

  // Read once per mount: the remembered form seeds every field below, so a
  // second visit opens on what the last scan ran with.
  const [remembered] = useState(readFormMemory)

  const [profile, setProfile] = useState<Profile>(remembered?.form.profile ?? 'baseline')
  const [ecosystems, setEcosystems] = useState<string[]>(
    remembered?.form.ecosystems ?? DEFAULT_ECOSYSTEMS,
  )
  const [roots, setRoots] = useState<string[]>(remembered?.form.roots ?? [])
  const [newRoot, setNewRoot] = useState('')
  const [exposureCatalog, setExposureCatalog] = useState(remembered?.form.exposureCatalog ?? '')
  const [findingsOnly, setFindingsOnly] = useState(remembered?.form.findingsOnly ?? false)
  const [maxDuration, setMaxDuration] = useState(remembered?.form.maxDuration ?? '')

  const [open, setOpen] = useState({ ecosystems: false, roots: false, exposure: false })
  const [activePreset, setActivePreset] = useState<string | null>(remembered?.activePreset ?? null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const form: ScanFormState = {
    profile,
    ecosystems,
    roots,
    exposureCatalog,
    findingsOnly,
    maxDuration,
  }
  const warnings = scanFormWarnings(form)

  function toggleSection(section: FormSection) {
    setOpen((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  // Land users where the missing input is when a preset needs roots.
  function revealSection(section: FormSection) {
    setOpen((prev) => ({ ...prev, [section]: true }))
  }

  function applyPreset(preset: Preset) {
    setProfile(preset.profile)
    setEcosystems(preset.ecosystems)
    setRoots(preset.roots)
    setActivePreset(preset.label)
    if (presetOpensRoots(preset)) revealSection('roots')
  }

  function toggleEcosystem(eco: string) {
    setEcosystems((prev) => withEcosystemToggled(prev, eco))
    setActivePreset(null)
  }

  function selectAllEcosystems() {
    setEcosystems([...ALL_ECOSYSTEMS])
  }

  function clearAllEcosystems() {
    setEcosystems([])
  }

  function addRoot() {
    const next = addedRoot(roots, newRoot)
    if (!next) return
    setRoots(next)
    setNewRoot('')
  }

  // A directory chosen from the mounted list rather than typed. Same rules: a
  // blank or an already-listed root changes nothing.
  function addRootPath(root: string) {
    const next = addedRoot(roots, root)
    if (!next) return
    setRoots(next)
  }

  function removeRoot(root: string) {
    setRoots((prev) => prev.filter((item) => item !== root))
  }

  function blockStart(problem: ScanFormProblem) {
    setValidationError(problem.message)
    if (problem.revealRoots) revealSection('roots')
  }

  async function submitScan() {
    try {
      const scan = await createScan(buildScanRequest(form))
      if (scan?.id) {
        writeFormMemory({ form, activePreset })
        navigate(`/results/${scan.id}`)
      }
    } catch {
      // Error is surfaced via the store
    }
  }

  async function startScan() {
    setValidationError(null)
    const problem = validateScanForm(form)
    if (problem) {
      blockStart(problem)
      return
    }
    await submitScan()
  }

  return {
    form,
    setProfile,
    newRoot,
    setNewRoot,
    setExposureCatalog,
    setFindingsOnly,
    setMaxDuration,
    open,
    toggleSection,
    activePreset,
    applyPreset,
    toggleEcosystem,
    selectAllEcosystems,
    clearAllEcosystems,
    addRoot,
    addRootPath,
    removeRoot,
    warnings,
    validationError,
    storeError,
    loading,
    startScan,
  }
}
