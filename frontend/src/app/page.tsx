import Link from 'next/link'
import {
  LayoutDashboard,
  Shield,
  AlertTriangle,
  Archive,
  ScanLine,
  CheckCircle,
  Clock,
} from 'lucide-react'
import StatCard from '@/components/StatCard'
import ThreatBadge from '@/components/ThreatBadge'
import DashboardCharts from '@/components/charts/DashboardCharts'
import { getStats, getScanHistory } from '@/lib/api'
import type { StatsResponse, ScanHistoryResponse, ScanResult } from '@/lib/api'
import { formatDate } from '@/lib/utils'

async function fetchStats(): Promise<StatsResponse> {
  try {
    return await getStats()
  } catch {
    return {
      total_scans: 0,
      clean_files: 0,
      threats_found: 0,
      quarantined_count: 0,
      engine_status: 'unknown',
      scans_today: 0,
      malicious_count: 0,
      suspicious_count: 0,
    }
  }
}

async function fetchHistory(): Promise<ScanHistoryResponse> {
  try {
    return await getScanHistory(200)
  } catch {
    return { items: [], total: 0, limit: 200, offset: 0 }
  }
}

function buildScanActivityData(
  items: ScanResult[]
): { date: string; count: number }[] {
  const counts: Record<string, number> = {}
  const now = new Date()

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    counts[key] = 0
  }

  for (const item of items) {
    const d = new Date(item.scanned_at)
    const diffMs = now.getTime() - d.getTime()
    if (diffMs > 7 * 24 * 60 * 60 * 1000) continue
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (key in counts) {
      counts[key] = (counts[key] ?? 0) + 1
    }
  }

  return Object.entries(counts).map(([date, count]) => ({ date, count }))
}

export default async function DashboardPage() {
  const [stats, history] = await Promise.all([fetchStats(), fetchHistory()])
  const scanActivityData = buildScanActivityData(history.items)
  const recentItems = history.items.slice(0, 5)

  const engineOnline = stats.engine_status?.toLowerCase() === 'active' ||
    stats.engine_status?.toLowerCase() === 'running' ||
    stats.engine_status?.toLowerCase() === 'online'

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard size={20} className="text-cyan" />
            <h1 className="text-xl font-mono font-bold text-white tracking-wide">
              Dashboard
            </h1>
          </div>
          <p className="text-sm text-gray-500 font-mono">
            System overview and recent activity
          </p>
        </div>
        <Link href="/scan" className="btn-cyan font-mono text-sm flex items-center gap-2">
          <ScanLine size={16} />
          Scan a File
        </Link>
      </div>

      {/* Engine status banner */}
      <div
        className={`glass-card px-5 py-4 flex items-center gap-3 ${
          engineOnline ? 'border-success/20' : 'border-warning/20'
        }`}
        style={{
          background: engineOnline
            ? 'rgba(0,255,136,0.04)'
            : 'rgba(255,170,0,0.04)',
        }}
      >
        <div
          className={`w-3 h-3 rounded-full flex-shrink-0 ${
            engineOnline ? 'bg-success animate-pulse' : 'bg-warning animate-pulse'
          }`}
        />
        <div>
          <span className="font-mono text-sm font-semibold text-white">
            Scan Engine —{' '}
          </span>
          <span
            className={`font-mono text-sm font-bold ${
              engineOnline ? 'text-success' : 'text-warning'
            }`}
          >
            {stats.engine_status
              ? stats.engine_status.charAt(0).toUpperCase() +
                stats.engine_status.slice(1)
              : 'Unknown'}
          </span>
        </div>
        {stats.last_scan_time && (
          <div className="ml-auto flex items-center gap-2 text-xs font-mono text-gray-500">
            <Clock size={12} />
            Last scan: {formatDate(stats.last_scan_time)}
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Scans"
          value={stats.total_scans}
          icon={ScanLine}
          color="cyan"
        />
        <StatCard
          title="Threats Found"
          value={stats.threats_found}
          icon={AlertTriangle}
          color="danger"
        />
        <StatCard
          title="Clean Files"
          value={stats.clean_files}
          icon={CheckCircle}
          color="success"
        />
        <StatCard
          title="Quarantined"
          value={stats.quarantined_count}
          icon={Archive}
          color="warning"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">
            Scans Today
          </p>
          <p className="text-2xl font-mono font-bold text-cyan">
            {(stats.scans_today ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">
            Malicious
          </p>
          <p className="text-2xl font-mono font-bold text-danger">
            {(stats.malicious_count ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">
            Suspicious
          </p>
          <p className="text-2xl font-mono font-bold text-warning">
            {(stats.suspicious_count ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Analytics charts */}
      <DashboardCharts
        scanActivityData={scanActivityData}
        clean={stats.clean_files}
        suspicious={stats.suspicious_count}
        malicious={stats.malicious_count}
      />

      {/* Recent scan history */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(0,212,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-cyan" />
            <h2 className="font-mono font-semibold text-white text-sm tracking-wide">
              Recent Scans
            </h2>
          </div>
          <Link
            href="/threats"
            className="text-xs font-mono text-cyan hover:text-white transition-colors"
          >
            View all →
          </Link>
        </div>

        {recentItems.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Shield size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="font-mono text-sm text-gray-500">No scans yet.</p>
            <p className="font-mono text-xs text-gray-600 mt-1">
              Upload a file to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-dark">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Threat Level</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentItems.map((item) => (
                  <tr key={item.scan_id}>
                    <td>
                      <span className="font-mono text-white">
                        {item.filename}
                      </span>
                    </td>
                    <td>
                      <ThreatBadge level={item.threat_level} size="sm" />
                    </td>
                    <td>
                      <span className="font-mono text-gray-400 text-xs">
                        {formatDate(item.scanned_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CTA */}
      <div
        className="glass-card p-8 text-center"
        style={{ background: 'rgba(0,212,255,0.03)' }}
      >
        <Shield size={40} className="text-cyan mx-auto mb-4 opacity-80" />
        <h3 className="font-mono font-bold text-white text-lg mb-2">
          Ready to scan?
        </h3>
        <p className="font-mono text-sm text-gray-400 mb-5">
          Drop any file to check it for threats, malware, and suspicious patterns.
        </p>
        <Link href="/scan" className="btn-cyan font-mono inline-flex items-center gap-2">
          <ScanLine size={16} />
          Scan a File Now
        </Link>
      </div>
    </div>
  )
}
