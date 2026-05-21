'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Shield, AlertCircle, RotateCcw } from 'lucide-react'
import ScanDropzone from '@/components/ScanDropzone'
import ScanResultCard from '@/components/ScanResultCard'
import { uploadFile, getScanResult } from '@/lib/api'
import type { ScanResult } from '@/lib/api'
import { ScanWebSocket } from '@/lib/websocket'
import type { ScanEvent } from '@/lib/websocket'

type ScanPhase = 'idle' | 'uploading' | 'scanning' | 'complete' | 'error'

export default function ScanPage() {
  const [phase, setPhase] = useState<ScanPhase>('idle')
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const wsRef = useRef<ScanWebSocket | null>(null)

  // Cleanup websocket on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.disconnect()
    }
  }, [])

  function reset() {
    wsRef.current?.disconnect()
    wsRef.current = null
    setPhase('idle')
    setProgress(0)
    setProgressMessage('')
    setScanResult(null)
    setErrorMessage(null)
  }

  const handleFileSelected = useCallback(async (file: File) => {
    // Reset any prior state
    wsRef.current?.disconnect()
    wsRef.current = null
    setScanResult(null)
    setErrorMessage(null)
    setProgress(0)
    setProgressMessage('Uploading…')
    setPhase('uploading')

    let scanId: string

    try {
      const upload = await uploadFile(file)
      scanId = upload.scan_id
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed')
      setPhase('error')
      return
    }

    // Switch to scanning phase
    setPhase('scanning')
    setProgress(5)
    setProgressMessage('Connecting to scan engine…')

    const ws = new ScanWebSocket(scanId, async (event: ScanEvent) => {
      switch (event.event_type) {
        case 'started':
          setProgress(10)
          setProgressMessage(event.message || 'Scan started…')
          break

        case 'progress':
          setProgress(Math.max(10, Math.min(95, event.progress)))
          setProgressMessage(event.message || 'Scanning…')
          break

        case 'completed': {
          setProgress(100)
          setProgressMessage('Scan complete. Fetching results…')
          // Fetch full result
          try {
            const result = await getScanResult(scanId)
            setScanResult(result)
            setPhase('complete')
          } catch (err) {
            setErrorMessage(
              err instanceof Error ? err.message : 'Failed to fetch scan result'
            )
            setPhase('error')
          }
          break
        }

        case 'failed':
          setErrorMessage(event.message || 'Scan failed')
          setPhase('error')
          break
      }
    })

    wsRef.current = ws
    ws.connect()
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Shield size={20} className="text-cyan" />
          <h1 className="text-xl font-mono font-bold text-white tracking-wide">
            Scan File
          </h1>
        </div>
        <p className="text-sm text-gray-500 font-mono">
          Upload any file to scan it for threats and malicious patterns
        </p>
      </div>

      {/* Dropzone — show when idle or to re-scan */}
      {(phase === 'idle' || phase === 'complete' || phase === 'error') && (
        <div className="space-y-4">
          {phase !== 'idle' && (
            <button
              onClick={reset}
              className="flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-cyan transition-colors"
            >
              <RotateCcw size={13} />
              Scan another file
            </button>
          )}
          {(phase === 'idle' || phase === 'error') && (
            <ScanDropzone onFileSelected={handleFileSelected} />
          )}
        </div>
      )}

      {/* Upload progress */}
      {phase === 'uploading' && (
        <div className="glass-card p-8 text-center space-y-4 animate-fade-in">
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-cyan/10 border border-cyan/30 flex items-center justify-center">
              <Shield size={28} className="text-cyan animate-pulse" />
            </div>
          </div>
          <div>
            <p className="font-mono font-semibold text-white">Uploading file…</p>
            <p className="font-mono text-sm text-gray-400 mt-1">{progressMessage}</p>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan to-cyan/60 rounded-full transition-all duration-500 progress-fill"
              style={{ width: '40%' }}
            />
          </div>
        </div>
      )}

      {/* Scanning progress */}
      {phase === 'scanning' && (
        <div className="glass-card p-8 space-y-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-full border-2 border-cyan/30 flex items-center justify-center">
                <div
                  className="w-10 h-10 rounded-full animate-radar-spin"
                  style={{
                    background:
                      'conic-gradient(from 0deg, transparent 0deg, rgba(5,255,133,0.4) 60deg, transparent 61deg)',
                  }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Shield size={16} className="text-cyan" />
              </div>
            </div>
            <div className="flex-1">
              <p className="font-mono font-semibold text-white">Scanning…</p>
              <p className="font-mono text-sm text-gray-400 mt-0.5">{progressMessage}</p>
            </div>
            <span className="font-mono text-2xl font-bold text-cyan tabular-nums">
              {progress}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #05ff85, rgba(5,255,133,0.6))',
                    boxShadow: '0 0 10px rgba(5,255,133,0.4)',
                  }}
              />
            </div>
            <div className="flex justify-between font-mono text-xs text-gray-600">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Scan steps */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Upload', threshold: 10 },
              { label: 'Heuristics', threshold: 30 },
              { label: 'Engines', threshold: 60 },
              { label: 'Report', threshold: 95 },
            ].map(({ label, threshold }) => (
              <div
                key={label}
                className={`p-3 rounded-xl border font-mono text-xs text-center transition-all duration-300 ${
                  progress >= threshold
                    ? 'border-cyan/30 bg-cyan/5 text-cyan'
                    : 'border-white/5 bg-white/[0.02] text-gray-600'
                }`}
              >
                {progress >= threshold ? '✓ ' : ''}
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {phase === 'error' && errorMessage && (
        <div
          className="glass-card p-6 border border-danger/30 animate-fade-in"
          style={{ background: 'rgba(255,51,102,0.04)' }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-danger flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-mono font-semibold text-danger">Scan Failed</p>
              <p className="font-mono text-sm text-gray-400 mt-1">{errorMessage}</p>
            </div>
          </div>
          <button
            onClick={reset}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm
              bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all duration-200"
          >
            <RotateCcw size={14} />
            Try Again
          </button>
        </div>
      )}

      {/* Scan result */}
      {phase === 'complete' && scanResult && (
        <div className="animate-slide-up">
          <ScanResultCard result={scanResult} />
        </div>
      )}
    </div>
  )
}
