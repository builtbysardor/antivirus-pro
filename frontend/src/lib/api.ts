const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const BASE = typeof window === 'undefined' ? `${API_BASE}/api` : '/api'

export type ThreatLevel = 'clean' | 'suspicious' | 'malicious' | 'unknown'

export interface HeuristicFinding {
  rule_name: string
  description: string
  severity: string
  category: string
  matched_value?: string
}

export interface EngineResult {
  engine_name: string
  detected: boolean
  threat_name?: string
  category?: string
  result?: string
}

export interface ScanResult {
  scan_id: string
  filename: string
  file_size: number
  file_type?: string
  sha256: string
  md5?: string
  threat_level: ThreatLevel
  is_malicious?: boolean
  scan_duration_ms: number
  scanned_at: string
  heuristic_findings?: HeuristicFinding[]
  engine_results?: EngineResult[]
  error_message?: string
  status: 'pending' | 'scanning' | 'completed' | 'failed'
  quarantined?: boolean
  quarantine_path?: string
}

export interface StatsResponse {
  total_scans: number
  clean_files: number
  threats_found: number
  quarantined_count: number
  last_scan_time?: string
  engine_status: string
  scans_today: number
  malicious_count: number
  suspicious_count: number
}

export interface ScanHistoryResponse {
  items: ScanResult[]
  total: number
  limit: number
  offset: number
}

export interface UploadResponse {
  scan_id: string
  message?: string
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    try {
      const errorBody = await response.json()
      errorMessage = errorBody.detail || errorBody.message || errorMessage
    } catch {
      // ignore parse errors
    }
    throw new Error(errorMessage)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${BASE}/scan/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    try {
      const errorBody = await response.json()
      errorMessage = errorBody.detail || errorBody.message || errorMessage
    } catch {
      // ignore
    }
    throw new Error(errorMessage)
  }

  return response.json()
}

export async function getScanResult(scanId: string): Promise<ScanResult> {
  return request<ScanResult>(`/scan/result/${scanId}`)
}

export async function getScanHistory(
  limit = 50,
  offset = 0,
  threat_level?: string,
  search?: string
): Promise<ScanHistoryResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })
  if (threat_level && threat_level !== 'all') {
    params.set('threat_level', threat_level)
  }
  if (search) {
    params.set('search', search)
  }
  return request<ScanHistoryResponse>(`/scan/history?${params}`)
}

export async function getStats(): Promise<StatsResponse> {
  return request<StatsResponse>('/stats')
}

export async function quarantineFile(
  scanId: string,
  reason?: string
): Promise<void> {
  await request<void>(`/quarantine/${scanId}`, {
    method: 'POST',
    body: JSON.stringify({ user_consent: true, reason: reason || 'Manual quarantine' }),
  })
}

export async function deleteQuarantined(scanId: string): Promise<void> {
  await request<void>(`/quarantine/${scanId}`, {
    method: 'DELETE',
    body: JSON.stringify({ confirm: true }),
  })
}

export async function restoreFile(
  scanId: string,
  restorePath: string
): Promise<void> {
  await request<void>(`/quarantine/${scanId}/restore`, {
    method: 'POST',
    body: JSON.stringify({ restore_path: restorePath }),
  })
}

export async function getQuarantined(): Promise<ScanResult[]> {
  return request<ScanResult[]>('/quarantine/')
}

export async function startRealtimeMonitor(directory: string): Promise<void> {
  await request<void>('/scan/realtime-monitor', {
    method: 'POST',
    body: JSON.stringify({ directory, action: 'start' }),
  })
}

export async function stopRealtimeMonitor(): Promise<void> {
  await request<void>('/scan/realtime-monitor', {
    method: 'POST',
    body: JSON.stringify({ action: 'stop' }),
  })
}
