import { describe, expect, it } from 'vitest'

import { mountNotice } from '@/lib/hostMount'

const report = (over: Partial<Parameters<typeof mountNotice>[0] & object> = {}) => ({
  mounted: true,
  path: '/host',
  parent: undefined,
  directories: [] as string[],
  ...over,
})

describe('mountNotice', () => {
  it('says nothing before the report arrives', () => {
    expect(mountNotice(null).text).toBe('')
  })

  it('lists what is mounted, by name', () => {
    const notice = mountNotice(report({ directories: ['/host/docs', '/host/projects'] }))

    expect(notice.tone).toBe('info')
    expect(notice.text).toContain('mounted read-only')
    expect(notice.text).toContain('docs, projects')
  })

  it('counts the rest when the listing is long', () => {
    const directories = Array.from({ length: 10 }, (_, index) => `/host/dir-${index}`)

    const notice = mountNotice(report({ directories }))

    expect(notice.text).toContain('and 2 more')
  })

  it('warns when nothing is mounted, and names the command that mounts one', () => {
    const notice = mountNotice(report({ mounted: false }))

    expect(notice.tone).toBe('warning')
    expect(notice.text).toContain('docker-compose.host-scan.yml')
  })

  it('warns when the mount is empty, and names the usual cause', () => {
    const notice = mountNotice(report())

    expect(notice.tone).toBe('warning')
    expect(notice.text).toContain('BUMBLEBEE_HOST_DIR')
  })
})
