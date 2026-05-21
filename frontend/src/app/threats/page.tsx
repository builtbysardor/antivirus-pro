'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, Trash2, RotateCcw, Archive, RefreshCw, AlertTriangle } from 'lucide-react'
import ThreatBadge from '@/components/ThreatBadge'
import ConfirmModal from '@/components/ConfirmModal'
import { getQuarantined, restoreFile, deleteQuarantined } from '@/lib/api'
import type { ScanResult } from '@/lib/api'
import { formatDate, formatBytes } from '@/lib/utils'

type ModalState =
  | { kind: 'none' }
  | { kind: 'restore'; file: ScanResult; path: string }
  | { kind: 'delete'; file: ScanResult }
  | { kind: 'alert'; message: string }

export default function ThreatsPage() {
  const [files, setFiles] = useState<ScanResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionState, setActionState] = useState<Record<string, 'restoring' | 'deleting' | null>>({})
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })

  const loadQuarantined = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getQuarantined()
      setFiles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quarantined files')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadQuarantined()
  }, [loadQuarantined])

  function setAction(scanId: string, state: 'restoring' | 'deleting' | null) {
    setActionState((prev) => ({ ...prev, [scanId]: state }))
  }

  function handleRestore(file: ScanResult) {
    setModal({ kind: 'restore', file, path: `/tmp/${file.filename}` })
  }

  async function confirmRestore() {
    if (modal.kind !== 'restore') return
    const { file, path } = modal
    if (!path.trim()) return
    setModal({ kind: 'none' })
    setAction(file.scan_id, 'restoring')
    try {
      await restoreFile(file.scan_id, path.trim())
      setFiles((prev) => prev.filter((f) => f.scan_id !== file.scan_id))
    } catch (err) {
      setModal({
        kind: 'alert',
        message: err instanceof Error ? err.message : 'Failed to restore file',
      })
    } finally {
      setAction(file.scan_id, null)
    }
  }

  function handleDelete(file: ScanResult) {
    setModal({ kind: 'delete', file })
  }

  async function confirmDelete() {
    if (modal.kind !== 'delete') return
    const { file } = modal
    setModal({ kind: 'none' })
    setAction(file.scan_id, 'deleting')
    try {
      await deleteQuarantined(file.scan_id)
      setFiles((prev) => prev.filter((f) => f.scan_id !== file.scan_id))
    } catch (err) {
      setModal({
        kind: 'alert',
        message: err instanceof Error ? err.message : 'Failed to delete file',
      })
    } finally {
      setAction(file.scan_id, null)
    }
  }

  function closeModal() {
    setModal({ kind: 'none' })
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Modals */}
      <ConfirmModal
        open={modal.kind === 'restore'}
        title="Restore File"
        message={
          modal.kind === 'restore'
            ? `Restore "${modal.file.filename}" from quarantine to the path below.`
            : ''
        }
        confirmLabel="Restore"
        confirmDanger={false}
        inputLabel="Restore path"
        inputValue={modal.kind === 'restore' ? modal.path : ''}
        onInputChange={(v) =>
          setModal((prev) =>
            prev.kind === 'restore' ? { ...prev, path: v } : prev
          )
        }
        onConfirm={confirmRestore}
        onCancel={closeModal}
      />

      <ConfirmModal
        open={modal.kind === 'delete'}
        title="Delete from Quarantine"
        message={
          modal.kind === 'delete'
            ? `Permanently delete "${modal.file.filename}" from quarantine? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        confirmDanger
        onConfirm={confirmDelete}
        onCancel={closeModal}
      />

      <ConfirmModal
        open={modal.kind === 'alert'}
        title="Error"
        message={modal.kind === 'alert' ? modal.message : ''}
        confirmLabel="OK"
        confirmDanger={false}
        onConfirm={closeModal}
        onCancel={closeModal}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={20} className="text-warning" />
            <h1 className="text-xl font-mono font-bold text-white tracking-wide">
              Threats &amp; Quarantine
            </h1>
          </div>
          <p className="text-sm text-gray-500 font-mono">
            Manage quarantined files and threat history
          </p>
        </div>
        <button
          onClick={loadQuarantined}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm
            bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white
            border border-white/10 transition-all duration-200 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      {!loading && !error && (
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card p-4 border-warning/20" style={{ background: 'rgba(255,170,0,0.03)' }}>
            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">
              Quarantined
            </p>
            <p className="text-2xl font-mono font-bold text-warning">{files.length}</p>
          </div>
          <div className="glass-card p-4 border-danger/20" style={{ background: 'rgba(255,51,102,0.03)' }}>
            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">
              Malicious
            </p>
            <p className="text-2xl font-mono font-bold text-danger">
              {files.filter((f) => f.threat_level === 'malicious').length}
            </p>
          </div>
          <div className="glass-card p-4 border-warning/20" style={{ background: 'rgba(255,170,0,0.03)' }}>
            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">
              Suspicious
            </p>
            <p className="text-2xl font-mono font-bold text-warning">
              {files.filter((f) => f.threat_level === 'suspicious').length}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="glass-card p-5 border border-danger/30"
          style={{ background: 'rgba(255,51,102,0.04)' }}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-danger" />
            <p className="font-mono text-sm text-danger">{error}</p>
            <button
              onClick={loadQuarantined}
              className="ml-auto text-xs font-mono text-gray-400 hover:text-white transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(0,212,255,0.08)' }}>
            <div className="skeleton h-4 w-40 rounded" />
          </div>
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-10 w-full rounded-xl" />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && files.length === 0 && (
        <div className="glass-card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-4">
            <Shield size={28} className="text-success" />
          </div>
          <h3 className="font-mono font-bold text-white text-lg mb-2">
            No quarantined files
          </h3>
          <p className="font-mono text-sm text-gray-500">
            All clear — no threats are currently in quarantine.
          </p>
        </div>
      )}

      {/* Quarantined files table */}
      {!loading && !error && files.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'rgba(0,212,255,0.08)' }}>
            <Archive size={16} className="text-warning" />
            <h2 className="font-mono font-semibold text-white text-sm">
              Quarantined Files
            </h2>
            <span className="ml-2 font-mono text-xs text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full">
              {files.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="table-dark">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Size</th>
                  <th>Threat Level</th>
                  <th>Quarantine Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => {
                  const busy = actionState[file.scan_id]
                  return (
                    <tr key={file.scan_id}>
                      <td>
                        <div>
                          <span className="font-mono text-white text-xs font-semibold">
                            {file.filename}
                          </span>
                          <p className="font-mono text-xs text-gray-600 mt-0.5 truncate max-w-[200px]">
                            {file.scan_id}
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-xs text-gray-400">
                          {formatBytes(file.file_size)}
                        </span>
                      </td>
                      <td>
                        <ThreatBadge level={file.threat_level} size="sm" />
                      </td>
                      <td>
                        <span className="font-mono text-xs text-gray-400">
                          {formatDate(file.scanned_at)}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRestore(file)}
                            disabled={!!busy}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs
                              bg-cyan/10 hover:bg-cyan/20 text-cyan border border-cyan/20
                              transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <RotateCcw size={11} className={busy === 'restoring' ? 'animate-spin' : ''} />
                            {busy === 'restoring' ? 'Restoring…' : 'Restore'}
                          </button>
                          <button
                            onClick={() => handleDelete(file)}
                            disabled={!!busy}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs
                              bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20
                              transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={11} />
                            {busy === 'deleting' ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
