import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function ScanLoadError({ title, error, scanId, recentPath, clearError }: {
  title: string
  error: string
  scanId?: string
  recentPath: string
  clearError: () => void
}) {
  const navigate = useNavigate()
  function dismiss() {
    clearError()
    if (scanId) navigate(recentPath)
  }
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="font-medium text-destructive">{title}</p>
      <p className="mb-4 text-sm text-muted-foreground">{error}</p>
      <Button variant="outline" onClick={dismiss}>
        {scanId ? 'Choose a recent scan' : 'Dismiss'}
      </Button>
    </div>
  )
}
