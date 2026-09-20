import { Plus, X } from 'lucide-react'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { PageHeader } from '@/components/PageHeader'
import { ScanEcosystems } from '@/components/ScanEcosystems'
import { ScanPresets } from '@/components/ScanPresets'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/lib/scanForm'
import { useScanForm } from '@/hooks/useScanForm'

// ---------------------------------------------------------------------------
// Scan Page
// ---------------------------------------------------------------------------

export default function Scan() {
  const {
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
    removeRoot,
    warnings,
    validationError,
    storeError,
    loading,
    startScan,
  } = useScanForm()

  // ---- Render ------------------------------------------------------------
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <PageHeader
        title="New scan"
        description="Pick ecosystems and root directories, then start a supply-chain scan."
      />

      {/* Quick Presets */}
      <ScanPresets activePreset={activePreset} onApply={applyPreset} />

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
            value={form.profile}
            onChange={(e) => setProfile(e.target.value as Profile)}
            className="h-9 rounded-md border border-input bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="baseline">baseline</option>
            <option value="project">project</option>
            <option value="deep">deep</option>
          </select>
        </div>

        {/* Deep-profile hint: the CLI requires explicit roots for deep scans */}
        {warnings.deepWithoutRoots && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
            The <strong>deep</strong> profile requires at least one root directory.
            Add one under <em>Root directories</em> below, or the scan will be
            rejected.
          </div>
        )}

        {/* Collapsible: Ecosystems */}
        <ScanEcosystems
          ecosystems={form.ecosystems}
          open={open.ecosystems}
          onToggle={() => toggleSection('ecosystems')}
          onToggleEcosystem={toggleEcosystem}
          onSelectAll={selectAllEcosystems}
          onClear={clearAllEcosystems}
        />

        {/* Collapsible: Root directories */}
        <CollapsibleSection
          title="Root directories"
          count={`${form.roots.length}`}
          open={open.roots}
          onToggle={() => toggleSection('roots')}
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

          {warnings.homeRoot && (
            <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
              Using <code className="font-mono">~</code> as a root without the{' '}
              <strong>deep</strong> profile may produce excessive results. Consider
              narrowing the path.
            </div>
          )}

          {form.roots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No roots configured. Scanning from the default paths.
            </p>
          ) : (
            <div className="space-y-2">
              {form.roots.map((root) => (
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
          open={open.exposure}
          onToggle={() => toggleSection('exposure')}
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Cross-reference findings against an exposure catalog file.
          </p>
          <input
            type="text"
            value={form.exposureCatalog}
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
              checked={form.findingsOnly}
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
              value={form.maxDuration}
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
          onClick={startScan}
          disabled={loading || form.ecosystems.length === 0}
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
