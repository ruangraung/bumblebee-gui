export type RouteEntry = {
  path: string
  label: string
}

// The app's pages, in sidebar order. The sidebar renders this list, and the
// header crumb reads it, so a page is added in one place.
export const ROUTES: RouteEntry[] = [
  { path: '/', label: 'Dashboard' },
  { path: '/scan', label: 'Scan' },
  { path: '/results', label: 'Results' },
  { path: '/findings', label: 'Findings' },
  { path: '/settings', label: 'Settings' },
]

// Detail routes hang off a list route, so the header can name them too.
const DETAIL_PREFIXES = ['/results/', '/findings/']

export function crumbFor(pathname: string): string {
  const entry = ROUTES.find((route) => route.path === pathname)
  if (entry) return entry.label.toLowerCase()

  const prefix = DETAIL_PREFIXES.find((candidate) => pathname.startsWith(candidate))
  if (prefix) {
    const parent = ROUTES.find((route) => route.path === prefix.slice(0, -1))
    if (parent) return parent.label.toLowerCase()
  }

  return 'not found'
}

// The sidebar calls the landing page "Dashboard" while its path is "/", so a
// typed label such as "/dashboard" is the one wrong address worth naming back.
export function suggestRoute(pathname: string): RouteEntry | null {
  const segment = pathname.replace(/\/+$/, '').split('/').pop()?.toLowerCase()
  if (!segment) return null
  return ROUTES.find((route) => route.label.toLowerCase() === segment) ?? null
}
