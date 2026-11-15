import { describe, expect, it } from 'vitest'
import { parseScanEvent } from './scanEvents'

describe('parseScanEvent', () => {
  it('parses a well-formed event', () => {
    const event = parseScanEvent('{"type":"progress","packages_found":12}')
    expect(event).not.toBeNull()
    expect(event?.type).toBe('progress')
    expect(event?.packages_found).toBe(12)
  })

  it('returns null for a payload that is not JSON', () => {
    expect(parseScanEvent('<html>proxy error page</html>')).toBeNull()
  })

  it('returns null for JSON that is not an object', () => {
    expect(parseScanEvent('"just a string"')).toBeNull()
    expect(parseScanEvent('[1,2,3]')).toBeNull()
  })

  it('returns null for an object with no type', () => {
    expect(parseScanEvent('{"packages_found":1}')).toBeNull()
  })
})
