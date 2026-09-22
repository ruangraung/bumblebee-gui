interface ScanOptionsProps {
  findingsOnly: boolean
  onFindingsOnlyChange: (value: boolean) => void
  maxDuration: string
  onMaxDurationChange: (value: string) => void
}

// The two options that sit outside the folding sections: report only findings,
// and how long the scan may run.
export function ScanOptions({
  findingsOnly,
  onFindingsOnlyChange,
  maxDuration,
  onMaxDurationChange,
}: ScanOptionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-6 pt-1">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={findingsOnly}
          onChange={(e) => onFindingsOnlyChange(e.target.checked)}
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
          onChange={(e) => onMaxDurationChange(e.target.value)}
          className="h-9 w-20 rounded-md border border-input bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="text-xs text-muted-foreground">30s, 10m or 2h; 0 for no limit</span>
      </div>
    </div>
  )
}
