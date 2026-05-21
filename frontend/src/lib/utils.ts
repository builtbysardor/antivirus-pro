export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${sizes[i]}`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function formatDate(iso: string): string {
  if (!iso) return 'N/A'
  try {
    const date = new Date(iso)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return 'Invalid date'
  }
}

export function getThreatColor(level: string): string {
  switch (level?.toLowerCase()) {
    case 'clean':
      return 'text-success border-success'
    case 'suspicious':
      return 'text-warning border-warning'
    case 'malicious':
      return 'text-danger border-danger'
    default:
      return 'text-gray-400 border-gray-600'
  }
}

export function getThreatBgColor(level: string): string {
  switch (level?.toLowerCase()) {
    case 'clean':
      return 'bg-success/10 text-success border border-success/30'
    case 'suspicious':
      return 'bg-warning/10 text-warning border border-warning/30'
    case 'malicious':
      return 'bg-danger/10 text-danger border border-danger/30'
    default:
      return 'bg-gray-800/50 text-gray-400 border border-gray-600/30'
  }
}

export function truncateSha(sha: string): string {
  if (!sha || sha.length <= 8) return sha || 'N/A'
  return `${sha.slice(0, 8)}...`
}
