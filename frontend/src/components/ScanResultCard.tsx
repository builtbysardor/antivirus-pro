'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Archive, FileText, Hash, Clock, HardDrive } from 'lucide-react'
import ThreatBadge from '@/components/ThreatBadge'
import { formatBytes, formatDuration, formatDate, truncateSha } from '@/lib/utils'
import { quarantineFile } from '@/lib/api'
import type { ScanResult } from '@/lib/api'

interface ScanResultCardProps {
  result: ScanResult
}

export default function ScanResultCard({ result }: ScanResultCardProps) {
  const [quarantined, setQuarantined] = useState(result.quarantined ?? false)
  const [quarantining, setQuarantining] = useState(false)
  const [quarantineError, setQuarantineError] = useState<string | null>(null)

  const canQuarantine =
    !quarantined && result.threat_level !== 'clean' && result.status === 'completed'

  async function handleQuarantine() {
    setQuarantining(true)
    setQuarantineError(null)
    try {
      await quarantineFile(result.scan_id, 'Manual quarantine from scan result')
      setQuarantined(true)
    } catch (err) {
      setQuarantineError(err instanceof Error ? err.message : 'Failed to quarantine file')
    } finally {
      setQuarantining(false)
    }
  }

  const threatIsHigh =
    result.threat_level === 'malicious' || result.threat_level === 'suspicious'

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Main result card */}
      <div
        className={`glass-card p-6 ${
          result.threat_level === 'malicious'
            ? 'border border-danger/30'
            : result.threat_level === 'suspicious'
            ? 'border border-warning/30'
            : result.threat_level === 'clean'
            ? 'border border-success/20'
            : ''
        }`}
        style={
          result.threat_level === 'malicious'
            ? { background: 'rgba(255,51,102,0.04)', boxShadow: '0 0 30px rgba(255,51,102,0.1)' }
            : result.threat_level === 'suspicious'
            ? { background: 'rgba(255,170,0,0.04)', boxShadow: '0 0 30px rgba(255,170,0,0.08)' }
            : undefined
        }
      >
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan/10 border border-cyan/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <FileText size={18} className="text-cyan" />
            </div>
            <div>
              <h2 className="font-mono font-bold text-white text-lg leading-tight break-all">
                {result.filename}
              </h2>
              <p className="font-mono text-xs text-gray-500 mt-1">
                Scan ID: {result.scan_id}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <ThreatBadge level={result.threat_level} size="lg" animate />
            {quarantined && (
              <span className="font-mono text-xs text-warning bg-warning/10 border border-warning/20 px-2 py-1 rounded-full flex items-center gap-1">
                <Archive size={11} />
                Quarantined
              </span>
            )}
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-1">
              <HardDrive size={12} className="text-gray-500" />
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Size</span>
            </div>
            <p className="font-mono text-sm text-white font-semibold">
              {formatBytes(result.file_size)}
            </p>
          </div>
          <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-1">
              <Hash size={12} className="text-gray-500" />
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">SHA256</span>
            </div>
            <p className="font-mono text-sm text-cyan" title={result.sha256}>
              {truncateSha(result.sha256)}
            </p>
          </div>
          <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={12} className="text-gray-500" />
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Duration</span>
            </div>
            <p className="font-mono text-sm text-white font-semibold">
              {formatDuration(result.scan_duration_ms)}
            </p>
          </div>
          <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={12} className="text-gray-500" />
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Scanned</span>
            </div>
            <p className="font-mono text-xs text-white">
              {formatDate(result.scanned_at)}
            </p>
          </div>
        </div>

        {/* Quarantine action */}
        {canQuarantine && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleQuarantine}
              disabled={quarantining}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm font-semibold
                bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30
                transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Archive size={14} />
              {quarantining ? 'Quarantining…' : 'Quarantine File'}
            </button>
            {quarantineError && (
              <span className="font-mono text-xs text-danger">{quarantineError}</span>
            )}
          </div>
        )}
      </div>

      {/* Heuristic findings */}
      {result.heuristic_findings && result.heuristic_findings.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'rgba(5,255,133,0.08)' }}>
            <AlertTriangleIcon className="text-warning" size={16} />
            <h3 className="font-mono font-semibold text-white text-sm">
              Heuristic Findings
              <span className="ml-2 text-warning text-xs bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full">
                {result.heuristic_findings.length}
              </span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table-dark">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Description</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                {result.heuristic_findings.map((finding, i) => (
                  <tr key={i}>
                    <td>
                      <span className="font-mono text-cyan text-xs">{finding.rule_name}</span>
                    </td>
                    <td>
                      <span className="text-gray-300 text-xs">{finding.description}</span>
                    </td>
                    <td>
                      <SeverityBadge severity={finding.severity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Engine results */}
      {result.engine_results && result.engine_results.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'rgba(5,255,133,0.08)' }}>
            <ShieldCheckIcon className="text-cyan" size={16} />
            <h3 className="font-mono font-semibold text-white text-sm">
              Engine Results
              <span className="ml-2 text-cyan text-xs bg-cyan/10 border border-cyan/20 px-2 py-0.5 rounded-full">
                {result.engine_results.length}
              </span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table-dark">
              <thead>
                <tr>
                  <th>Engine</th>
                  <th>Detected</th>
                  <th>Threat Name</th>
                </tr>
              </thead>
              <tbody>
                {result.engine_results.map((engine, i) => (
                  <tr key={i}>
                    <td>
                      <span className="font-mono text-white text-xs">{engine.engine_name}</span>
                    </td>
                    <td>
                      {engine.detected ? (
                        <span className="flex items-center gap-1 text-danger text-xs font-mono font-semibold">
                          <XCircle size={13} />
                          Yes
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-success text-xs font-mono font-semibold">
                          <CheckCircle size={13} />
                          No
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="font-mono text-xs text-gray-400">
                        {engine.threat_name || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error message */}
      {result.error_message && (
        <div className="glass-card p-4 border border-danger/20" style={{ background: 'rgba(255,51,102,0.04)' }}>
          <p className="font-mono text-sm text-danger">
            <span className="font-bold">Error: </span>
            {result.error_message}
          </p>
        </div>
      )}
    </div>
  )
}

// Inline small icon components to avoid importing non-existent files
function AlertTriangleIcon({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      width={size ?? 16}
      height={size ?? 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function ShieldCheckIcon({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      width={size ?? 16}
      height={size ?? 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity?.toLowerCase()
  const cls =
    s === 'critical' || s === 'high'
      ? 'text-danger bg-danger/10 border-danger/30'
      : s === 'medium'
      ? 'text-warning bg-warning/10 border-warning/30'
      : s === 'low'
      ? 'text-success bg-success/10 border-success/30'
      : 'text-gray-400 bg-gray-800/50 border-gray-600/30'

  return (
    <span className={`font-mono text-xs px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold ${cls}`}>
      {severity || 'unknown'}
    </span>
  )
}
