import { describe, expect, it } from 'vitest'

import { catalogueLine } from '@/lib/catalogue'

const summary = (over: Partial<Parameters<typeof catalogueLine>[0] & object> = {}) => ({
  catalogues: 11,
  entries: 700,
  versions: 1072,
  available: true,
  ...over,
})

describe('catalogueLine', () => {
  it('says nothing before the count arrives', () => {
    expect(catalogueLine(null)).toBe('')
  })

  it('states what was compared, with the versions grouped', () => {
    const line = catalogueLine(summary())

    expect(line).toContain('1,072 package versions')
    expect(line).toContain('11 bundled catalogues')
    expect(line).toContain('rather than by CVE')
  })

  it('says a scan with no catalogues cannot match anything', () => {
    const line = catalogueLine(summary({ available: false, catalogues: 0, versions: 0 }))

    expect(line).toContain('cannot report a match')
  })
})
