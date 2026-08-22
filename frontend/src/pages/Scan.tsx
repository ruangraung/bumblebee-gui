import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { useScanStore } from '@/stores/scanStore'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

const ALL_ECOSYSTEMS = [
  'npm', 'pypi', 'go', 'rubygems', 'packagist',
  'mcp', 'editor-extension', 'browser-extension',
]

const DEFAULT_ECOSYSTEMS = ['npm', 'pypi']

const PRESETS: Preset[] = [
  {
    label: 'Baseline',
    description: 'Common ecosystems, quick scan',
    profile: 'baseline',
    ecosystems: [...DEFAULT_ECOSYSTEMS],
    roots: [],
  },
  {
    label: 'Project',
    description: 'Current project dependencies',
    profile: 'project',
    ecosystems: ['npm', 'pypi', 'go', 'rubygems'],
    roots: ['.'],
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string
  count?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent/50"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1">{title}</span>
        {count !== undefined && (
          <span className="font-mono text-xs text-muted-foreground">{count}</span>
        )}
      </button>
      {open && <div className="border-t border-border px-4 py-4">{children}</div>}
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
  const [ecosystems, setEcosystems] = useState<string[]>(DEFAULT_ECOSYSTEMS)
  const [roots, setRoots] = useState<string[]>([])
  const [newRoot, setNewRoot] = useState('')
  const [exposureCatalog, setExposureCatalog] = useState('')
  const [findingsOnly, setFindingsOnly] = useState(false)
  const [maxDuration, setMaxDuration] = useState('10m')

  // ---- Collapsible state -------------------------------------------------
  const [ecoOpen, setEcoOpen] = useState(false)
  const [rootsOpen, setRootsOpen] = useState(false)
  const [exposureOpen, setExposureOpen] = useState(false)

  // ---- Active preset (for the highlighted preset card) -------------------
  const [activePreset, setActivePreset] = useState<string | null>(null)

  // ---- Local validation error --------------------------------------------
  const [validationError, setValidationError] = useState<string | null>(null)

  // ---- Derived warnings --------------------------------------------------
  const usesHomeRoot = roots.some((r) => r === '~' || r.startsWith('~/'))
  const showHomeRootWarning = usesHomeRoot && profile !== 'deep'
  // The bumblebee CLI rejects `deep` without explicit roots by design
  // (incident-response profile refuses to auto-configure).
  const deepNeedsRoots = profile === 'deep' && roots.length === 0

  // ---- Preset application ------------------------------------------------
  function applyPreset(preset: Preset) {
    setProfile(preset.profile)
    setEcosystems(preset.ecosystems)
    setRoots(preset.roots)
    setActivePreset(preset.label)
    // Land users where the missing input is if the preset needs roots.
    if (preset.profile === 'deep' && preset.roots.length === 0) {
      setRootsOpen(true)
    }
  }

  // ---- Ecosystem toggles -------------------------------------------------
  function toggleEcosystem(eco: string) {
    setEcosystems((prev) =>
      prev.includes(eco) ? prev.filter((e) => e !== eco) : [...prev, eco],
    )
    setActivePreset(null)
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

    if (profile === 'deep' && roots.length === 0) {
      setValidationError(
        'The deep profile requires at least one root directory. Add one under "Root directories".',
      )
      setRootsOpen(true)
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
      <PageHeader
        title="New scan"
        description="Pick ecosystems and root directories, then start a supply-chain scan."
      />

      {/* Quick Presets */}
      <section className="space-y-3">
        <h2 className="overline">Quick presets</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRESETS.map((preset) => {
            const active = activePreset === preset.label
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-lg border bg-card p-4 text-left transition-colors',
                  active
                    ? 'border-primary/60 bg-primary/5'
                    : 'hover:border-muted-foreground/40 hover:bg-accent/50',
                )}
              >
                <span className="text-sm font-medium">{preset.label}</span>
                <span className="text-xs leading-snug text-muted-foreground">
                  {preset.description}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Scan Configuration */}
      <section className="space-y-4">
        <h2 className="overline">Configuration</h2>

        {/* Profile dropdown */}
        <div className="flex items-center gap-3">
          <label htmlFor="profile" className="w-20 shrink-0 text-sm font-medium">
            Profile
          </label>
          <select
            id="profile"
            value={profile}
            onChange={(e) => setProfile(e.target.value as Profile)}
            className="h-9 rounded-md border border-input bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="baseline">baseline</option>
            <option value="project">project</option>
            <option value="deep">deep</option>
          </select>
        </div>

        {/* Deep-profile hint: the CLI requires explicit roots for deep scans */}
        {deepNeedsRoots && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
            The <strong>deep</strong> profile requires at least one root directory
            — add one under <em>Root directories</em> below, or the scan will be
            rejected.
          </div>
        )}

        {/* Collapsible: Ecosystems */}
        <CollapsibleSection
          title="Ecosystems"
          count={`${ecosystems.length}/${ALL_ECOSYSTEMS.length}`}
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
              Select all
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearAllEcosystems}
            >
              Clear
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALL_ECOSYSTEMS.map((eco) => {
              const checked = ecosystems.includes(eco)
              return (
                <label
                  key={eco}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 font-mono text-sm transition-colors',
                    checked
                      ? 'border-primary/50 bg-primary/5 text-foreground'
                      : 'text-muted-foreground hover:bg-accent/50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleEcosystem(eco)}
                    className="accent-primary"
                  />
                  {eco}
                </label>
              )
            })}
          </div>
        </CollapsibleSection>

        {/* Collapsible: Root directories */}
        <CollapsibleSection
          title="Root directories"
          count={`${roots.length}`}
          open={rootsOpen}
          onToggle={() => setRootsOpen((v) => !v)}
        >
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={newRoot}
              onChange={(e) => setNewRoot(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRoot())}
              placeholder="e.g. ./src or ~/projects"
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRoot}
              disabled={!newRoot.trim()}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>

          {showHomeRootWarning && (
            <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
              Using <code className="font-mono">~</code> as a root without the{' '}
              <strong>deep</strong> profile may produce excessive results. Consider
              narrowing the path.
            </div>
          )}

          {roots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No roots configured — scanning from default paths.
            </p>
          ) : (
            <div className="space-y-2">
              {roots.map((root) => (
                <div
                  key={root}
                  className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2"
                >
                  <code className="font-mono text-sm">{root}</code>
                  <button
                    type="button"
                    onClick={() => removeRoot(root)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={`Remove ${root}`}
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
          <p className="mb-3 text-sm text-muted-foreground">
            Cross-reference findings against an exposure catalog file.
          </p>
          <input
            type="text"
            value={exposureCatalog}
            onChange={(e) => setExposureCatalog(e.target.value)}
            placeholder="Path to exposure catalog file"
            className="h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </CollapsibleSection>

        {/* Additional options row */}
        <div className="flex flex-wrap items-center gap-6 pt-1">
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
              className="h-9 w-20 rounded-md border border-input bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
      <div className="flex justify-end border-t border-border pt-5">
        <Button
          type="button"
          onClick={handleStartScan}
          disabled={loading || ecosystems.length === 0}
          className="min-w-[160px]"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Scanning…
            </span>
          ) : (
            'Start scan'
          )}
        </Button>
      </div>
    </div>
  )
}
