import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { useScanStore } from '@/stores/scanStore'
import { Button } from '@/components/ui/button'
import type { ScanRequest } from '@/lib/api'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type Profile = ScanRequest['profile']

interface Preset {
  label: string
  description: string
  profile: Profile
  ecosystems: string[]
  roots: string[]
}

const PRESETS: Preset[] = [
  {
    label: 'Baseline',
    description: 'Quick scan of common ecosystems',
    profile: 'baseline',
    ecosystems: ['npm', 'pypi'],
    roots: [],
  },
  {
    label: 'Project',
    description: 'Scan current project dependencies',
    profile: 'project',
    ecosystems: ['npm', 'pypi', 'go', 'cargo'],
    roots: ['.'],
  },
  {
    label: 'npm only',
    description: 'Only npm ecosystem',
    profile: 'baseline',
    ecosystems: ['npm'],
    roots: [],
  },
  {
    label: 'Deep',
    description: 'Comprehensive scan of all ecosystems',
    profile: 'deep',
    ecosystems: ['npm', 'pypi', 'go', 'cargo', 'maven', 'nuget', 'rubygems', 'cocoapods'],
    roots: [],
  },
]

const ALL_ECOSYSTEMS = [
  'npm',
  'pypi',
  'go',
  'cargo',
  'maven',
  'nuget',
  'rubygems',
  'cocoapods',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left font-medium hover:bg-accent transition-colors"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        {title}
      </button>
      {open && <div className="border-t px-4 py-4">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scan Page
// ---------------------------------------------------------------------------

export default function Scan() {
  const navigate = useNavigate()
  const { createScan, loading, error: storeError } = useScanStore()

  // ---- Form state --------------------------------------------------------
  const [profile, setProfile] = useState<Profile>('baseline')
  const [ecosystems, setEcosystems] = useState<string[]>(['npm', 'pypi'])
  const [roots, setRoots] = useState<string[]>([])
  const [newRoot, setNewRoot] = useState('')
  const [exposureCatalog, setExposureCatalog] = useState('')
  const [findingsOnly, setFindingsOnly] = useState(false)
  const [maxDuration, setMaxDuration] = useState('10m')

  // ---- Collapsible state -------------------------------------------------
  const [ecoOpen, setEcoOpen] = useState(false)
  const [rootsOpen, setRootsOpen] = useState(false)
  const [exposureOpen, setExposureOpen] = useState(false)

  // ---- Local validation error --------------------------------------------
  const [validationError, setValidationError] = useState<string | null>(null)

  // ---- Derived warnings --------------------------------------------------
  const usesHomeRoot = roots.some((r) => r === '~' || r.startsWith('~/'))
  const showHomeRootWarning = usesHomeRoot && profile !== 'deep'

  // ---- Preset application ------------------------------------------------
  function applyPreset(preset: Preset) {
    setProfile(preset.profile)
    setEcosystems(preset.ecosystems)
    setRoots(preset.roots)
  }

  // ---- Ecosystem toggles -------------------------------------------------
  function toggleEcosystem(eco: string) {
    setEcosystems((prev) =>
      prev.includes(eco) ? prev.filter((e) => e !== eco) : [...prev, eco],
    )
  }

  function selectAllEcosystems() {
    setEcosystems([...ALL_ECOSYSTEMS])
  }

  function clearAllEcosystems() {
    setEcosystems([])
  }

  // ---- Root directory management -----------------------------------------
  function addRoot() {
    const trimmed = newRoot.trim()
    if (!trimmed) return
    if (roots.includes(trimmed)) return
    setRoots((prev) => [...prev, trimmed])
    setNewRoot('')
  }

  function removeRoot(root: string) {
    setRoots((prev) => prev.filter((r) => r !== root))
  }

  // ---- Scan submission ---------------------------------------------------
  async function handleStartScan() {
    setValidationError(null)

    if (ecosystems.length === 0) {
      setValidationError('Select at least one ecosystem.')
      return
    }

    const request: ScanRequest = {
      profile,
      ecosystems,
      roots: roots.length > 0 ? roots : undefined,
      exposure_catalog: exposureCatalog || undefined,
      findings_only: findingsOnly,
      max_duration: maxDuration,
    }

    try {
      const scan = await createScan(request)
      if (scan?.id) {
        navigate(`/results/${scan.id}`)
      }
    } catch {
      // Error is surfaced via the store
    }
  }

  // ---- Render ------------------------------------------------------------
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Scan</h1>
        <p className="text-muted-foreground mt-1">
          Configure and trigger supply chain security scans.
        </p>
      </div>

      {/* Quick Presets */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Presets
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className="flex flex-col items-start gap-1 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent"
            >
              <span className="text-sm font-semibold">{preset.label}</span>
              <span className="text-xs text-muted-foreground leading-snug">
                {preset.description}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Scan Configuration */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Scan Configuration
        </h2>

        {/* Profile dropdown */}
        <div className="flex items-center gap-3">
          <label htmlFor="profile" className="text-sm font-medium w-16">
            Profile
          </label>
          <select
            id="profile"
            value={profile}
            onChange={(e) => setProfile(e.target.value as Profile)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="baseline">baseline</option>
            <option value="project">project</option>
            <option value="deep">deep</option>
          </select>
        </div>

        {/* Collapsible: Ecosystems */}
        <CollapsibleSection
          title={`Ecosystems (${ecosystems.length}/${ALL_ECOSYSTEMS.length})`}
          open={ecoOpen}
          onToggle={() => setEcoOpen((v) => !v)}
        >
          <div className="mb-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAllEcosystems}
            >
              Select All
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearAllEcosystems}
            >
              Clear All
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ALL_ECOSYSTEMS.map((eco) => (
              <label
                key={eco}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={ecosystems.includes(eco)}
                  onChange={() => toggleEcosystem(eco)}
                  className="accent-primary"
                />
                {eco}
              </label>
            ))}
          </div>
        </CollapsibleSection>

        {/* Collapsible: Root directories */}
        <CollapsibleSection
          title={`Root directories (${roots.length})`}
          open={rootsOpen}
          onToggle={() => setRootsOpen((v) => !v)}
        >
          {/* Add root input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newRoot}
              onChange={(e) => setNewRoot(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRoot())}
              placeholder="e.g. ./src or ~/projects"
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRoot}
              disabled={!newRoot.trim()}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Warning for ~ without deep profile */}
          {showHomeRootWarning && (
            <div className="mb-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Using <code>~</code> as a root directory without the{' '}
              <strong>deep</strong> profile may produce excessive results.
              Consider switching to the <strong>deep</strong> profile or
              narrowing the path.
            </div>
          )}

          {/* Root list */}
          {roots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No root directories configured. Scanning from default paths.
            </p>
          ) : (
            <div className="space-y-2">
              {roots.map((root) => (
                <div
                  key={root}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <code className="font-mono">{root}</code>
                  <button
                    type="button"
                    onClick={() => removeRoot(root)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Collapsible: Exposure catalog */}
        <CollapsibleSection
          title="Exposure catalog"
          open={exposureOpen}
          onToggle={() => setExposureOpen((v) => !v)}
        >
          <p className="text-sm text-muted-foreground mb-3">
            Provide an exposure catalog file to cross-reference findings.
          </p>
          <input
            type="text"
            value={exposureCatalog}
            onChange={(e) => setExposureCatalog(e.target.value)}
            placeholder="Path to exposure catalog file"
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </CollapsibleSection>

        {/* Additional options row */}
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={findingsOnly}
              onChange={(e) => setFindingsOnly(e.target.checked)}
              className="accent-primary"
            />
            Findings only
          </label>

          <div className="flex items-center gap-2">
            <label htmlFor="maxDuration" className="text-sm">
              Max duration
            </label>
            <input
              id="maxDuration"
              type="text"
              value={maxDuration}
              onChange={(e) => setMaxDuration(e.target.value)}
              className="h-9 w-20 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </section>

      {/* Error message */}
      {(validationError || storeError) && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {validationError || storeError}
        </div>
      )}

      {/* Start Scan */}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleStartScan}
          disabled={loading || ecosystems.length === 0}
          className="min-w-[140px]"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Scanning…
            </span>
          ) : (
            'Start Scan'
          )}
        </Button>
      </div>
    </div>
  )
}
