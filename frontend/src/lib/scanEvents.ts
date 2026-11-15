import type { ScanEvent } from './api'

// Parse one SSE data payload into a ScanEvent, or null when it is not one.
// The event stream is the backend's own output, but the payloads travel as
// opaque strings over a transport that can also deliver a proxy's error page,
// and a bare JSON.parse throws straight out of the listener. Callers that
// treat null as "nothing understood" keep their fallback paths alive.
export function parseScanEvent(raw: string): ScanEvent | null {
  try {
    const data = JSON.parse(raw) as Partial<ScanEvent>
    if (typeof data !== 'object' || data === null) return null
    if (typeof data.type !== 'string') return null
    return data as ScanEvent
  } catch {
    return null
  }
}
