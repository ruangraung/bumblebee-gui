import { Link, useLocation } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { suggestRoute } from '@/lib/routes'

export default function NotFound() {
  const { pathname } = useLocation()
  const hint = suggestRoute(pathname)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Page not found" description="Every page is listed in the sidebar." />

      {/* Neutral tone: a wrong address is a miss, not a failed scan. */}
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
          <FileQuestion className="h-6 w-6" />
        </div>
        <p className="mt-3 max-w-full break-all px-4 font-mono text-sm text-foreground">{pathname}</p>
        {hint && (
          <p className="mt-1 text-sm text-muted-foreground">
            {hint.label} lives at {hint.path}.
          </p>
        )}
        <Link to="/" className={buttonVariants({ size: 'sm', className: 'mt-4' })}>
          Open Dashboard
        </Link>
      </div>
    </div>
  )
}
