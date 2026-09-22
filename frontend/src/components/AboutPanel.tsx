import { useAboutFacts } from '@/hooks/useAboutFacts'
import { catalogueLine } from '@/lib/catalogue'
import { mountLine, scannerLine } from '@/lib/about'

const REPO = 'https://github.com/ruangraung/bumblebee-gui'

// What this install is, read from the API rather than written into the page. A
// fact that could not be read says so; nothing here is filled in with a guess.
export function AboutPanel() {
  const facts = useAboutFacts()

  return (
    <div className="space-y-4 rounded-lg border bg-card px-4 py-4">
      <dl className="space-y-3">
        <Fact label="Interface" value={facts.appVersion ?? 'reading it'} />
        <Fact label="Scanner CLI" value={scannerLine(facts.scanner)} />
        <Fact
          label="Exposure catalogues"
          value={catalogueLine(facts.catalogues) || 'reading it'}
        />
        <Fact label="Host mount" value={mountLine(facts.mount)} />
      </dl>

      <p className="break-words text-sm text-muted-foreground">
        An unofficial interface for the Perplexity Bumblebee CLI. It is not
        affiliated with or endorsed by Perplexity AI.
      </p>

      <p className="break-words text-sm text-muted-foreground">
        Source at <ExternalLink href={REPO}>github.com/ruangraung/bumblebee-gui</ExternalLink>,
        with its <ExternalLink href={`${REPO}/blob/main/README.md`}>README</ExternalLink>,{' '}
        <ExternalLink href={`${REPO}/blob/main/SECURITY.md`}>security policy</ExternalLink> and{' '}
        <ExternalLink href={`${REPO}/blob/main/LICENSE`}>Apache-2.0 licence</ExternalLink>.
      </p>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words font-mono text-xs">{value}</dd>
    </div>
  )
}

// Underlined rather than coloured, so the link is still a link without relying
// on colour alone.
function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="underline underline-offset-2 hover:text-foreground"
    >
      {children}
    </a>
  )
}
