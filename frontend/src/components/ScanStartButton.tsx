import { Button } from '@/components/ui/button'

interface ScanStartButtonProps {
  loading: boolean
  disabled: boolean
  onStart: () => void
}

// The primary action, sitting on the page's footer rule. While the store is
// submitting, the label is replaced by the spinner and the same word.
export function ScanStartButton({ loading, disabled, onStart }: ScanStartButtonProps) {
  return (
    <div className="flex justify-end border-t border-border pt-5">
      <Button
        type="button"
        onClick={onStart}
        disabled={disabled}
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
  )
}
