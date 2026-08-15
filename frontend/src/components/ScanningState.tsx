import { Scan, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Shared scan-lifecycle visuals (pulse ring + sweep bar) and the full-size
// scanning state block used by Results. Kept together so the dashboard's
// "Running now" cards and the Results page stay visually consistent.

export function ScanPulseRing() {
  return (
    <div className="relative shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/20" />
      <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
        <Scan className="h-5 w-5" />
      </span>
    </div>
  )
}

export function ScanSweepBar({ className = 'mt-6 h-1 w-64' }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-full bg-muted ${className}`}>
      <div className="h-full w-1/3 animate-scan-sweep rounded-full bg-primary" />
    </div>
  )
}

export function ScanningState({
  packagesFound,
  onCancel,
}: {
  packagesFound?: number
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
      <ScanPulseRing />
      <p className="mt-4 text-sm font-medium">Scan in progress</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        {typeof packagesFound === 'number' && packagesFound > 0
          ? `${packagesFound.toLocaleString()} packages found so far`
          : 'discovering packages…'}
      </p>
      <ScanSweepBar />
      <Button variant="destructive" size="sm" className="mt-6" onClick={onCancel}>
        <X className="mr-1.5 h-4 w-4" />
        Cancel scan
      </Button>
    </div>
  )
}
