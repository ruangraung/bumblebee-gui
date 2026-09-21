import { PageHeader } from '@/components/PageHeader'
import { ScanEcosystems } from '@/components/ScanEcosystems'
import { ScanErrorNotice } from '@/components/ScanErrorNotice'
import { ScanExposureCatalog } from '@/components/ScanExposureCatalog'
import { ScanOptions } from '@/components/ScanOptions'
import { ScanRootDirectories } from '@/components/ScanRootDirectories'
import { ScanPresets } from '@/components/ScanPresets'
import { ScanStartButton } from '@/components/ScanStartButton'
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
    addRootPath,
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
        <ScanRootDirectories
          roots={form.roots}
          newRoot={newRoot}
          showHomeRootWarning={warnings.homeRoot}
          open={open.roots}
          onToggle={() => toggleSection('roots')}
          onNewRootChange={setNewRoot}
          onAdd={addRoot}
          onAddPath={addRootPath}
          onRemove={removeRoot}
        />

        {/* Collapsible: Exposure catalog */}
        <ScanExposureCatalog
          value={form.exposureCatalog}
          open={open.exposure}
          onToggle={() => toggleSection('exposure')}
          onChange={setExposureCatalog}
        />

        {/* Additional options row */}
        <ScanOptions
          findingsOnly={form.findingsOnly}
          onFindingsOnlyChange={setFindingsOnly}
          maxDuration={form.maxDuration}
          onMaxDurationChange={setMaxDuration}
        />
      </section>

      {/* Error message */}
      <ScanErrorNotice validationError={validationError} storeError={storeError} />

      {/* Start Scan */}
      <ScanStartButton
        loading={loading}
        disabled={loading || form.ecosystems.length === 0}
        onStart={startScan}
      />
    </div>
  )
}
