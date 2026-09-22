export interface ScanRequest {
  profile: 'baseline' | 'project' | 'deep'
  ecosystems?: string[]
  roots?: string[]
  exposure_catalog?: string
  findings_only?: boolean
  max_duration?: string
}

export interface ScanSummary {
  total_packages: number
  ecosystems_found: number
  findings_count: number
  ecosystem_counts: Record<string, number>
  timed_out?: boolean
  duration_ms?: number
  files_considered?: number
}

export interface ScanRecord {
  id: number
  timestamp: string
  profile: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  summary?: ScanSummary
  ndjson_path?: string
  /** Live progress while running (packages discovered so far); final total when completed. */
  packages_found?: number
}

export interface HostMountReport {
  mounted: boolean
  path: string
  parent?: string
  directories: string[]
}

export interface CatalogueSummary {
  catalogues: number
  entries: number
  versions: number
  available: boolean
}

export interface PackageRecord {
  package_name: string
  ecosystem: string
  version: string
  source_type?: string
  source_file?: string
  project_path?: string
  package_manager?: string
  confidence?: string
  has_lifecycle_scripts?: boolean
}

export interface FindingRecord {
  package_name: string
  version: string
  ecosystem: string
  severity: string
  catalog_id: string
  catalog_name: string
  evidence: string
  source_file?: string
  source_type?: string
  root_kind?: string
  project_path?: string
  confidence?: string
}

export type ScanEventType = 'snapshot' | 'progress' | 'completed' | 'failed' | 'cancelled'

export interface ScanEvent {
  type: ScanEventType
  status?: string
  packages_found?: number
  summary?: ScanSummary
  error?: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || `Request failed: ${response.status}`)
  }

  return response.json()
}

export const api = {
  async health(): Promise<{ status: string; version: string }> {
    return request('/api/health')
  },

  async createScan(scanRequest: ScanRequest): Promise<ScanRecord> {
    return request('/api/scans', {
      method: 'POST',
      body: JSON.stringify(scanRequest),
    })
  },

  async listScans(limit?: number): Promise<ScanRecord[]> {
    const params = limit ? `?limit=${limit}` : ''
    return request(`/api/scans${params}`)
  },

  async hostDirectories(path?: string): Promise<HostMountReport> {
    const params = path ? `?path=${encodeURIComponent(path)}` : ''
    return request(`/api/host-directories${params}`)
  },

  async exposureCatalogue(): Promise<CatalogueSummary> {
    return request('/api/exposure-catalog')
  },

  async getScan(id: number): Promise<ScanRecord> {
    return request(`/api/scans/${id}`)
  },

  async deleteScan(id: number): Promise<void> {
    await request(`/api/scans/${id}`, { method: 'DELETE' })
  },

  async getScanPackages(id: number): Promise<PackageRecord[]> {
    return request(`/api/scans/${id}/packages`)
  },

  async getScanFindings(id: number): Promise<FindingRecord[]> {
    return request(`/api/scans/${id}/findings`)
  },

  scanEventsUrl(id: number): string {
    return `/api/scans/${id}/events`
  },

  async exportScan(id: number, format: 'json' | 'csv'): Promise<Blob> {
    const response = await fetch(`/api/scans/${id}/export?format=${format}`)
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`)
    }
    return response.blob()
  },
}
