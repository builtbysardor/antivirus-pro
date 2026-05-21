'use client'

import { useState, useRef, useEffect } from 'react'
import { Activity, FolderOpen, Play, Square, Shield, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import { startRealtimeMonitor, stopRealtimeMonitor } from '@/lib/api'
import { formatDate } from '@/lib/utils'

interface MonitorEvent {
  id: string
  timestamp: string
  path: string
  eventType: 'detected' | 'clean' | 'error' | 'info'
  message: string
}

export default function MonitorPage() {
  const [directory, setDirectory] = useState('/home')
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<MonitorEvent[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll log to bottom when new events arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  function appendEvent(event: Omit<MonitorEvent, 'id'>) {
    setEvents((prev) => [
      ...prev,
      { ...event, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
    ])
  }

  async function handleStart() {
    if (!directory.trim()) return
    setLoading(true)
    setError(null)
    try {
      await startRealtimeMonitor(directory.trim())
      setIsMonitoring(true)
      appendEvent({
        timestamp: new Date().toISOString(),
        path: directory.trim(),
        eventType: 'info',
        message: `Monitor started — watching ${directory.trim()}`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start monitor')
    } finally {
      setLoading(false)
    }
  }

  async function handleStop() {
    setLoading(true)
    setError(null)
    try {
      await stopRealtimeMonitor()
      setIsMonitoring(false)
      appendEvent({
        timestamp: new Date().toISOString(),
        path: '',
        eventType: 'info',
        message: 'Monitor stopped.',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop monitor')
    } finally {
      setLoading(false)
    }
  }

  function clearLog() {
    setEvents([])
  }

  function getEventIcon(type: MonitorEvent['eventType']) {
    switch (type) {
      case 'detected':
        return <AlertTriangle size={13} className="text-danger flex-shrink-0" />
      case 'clean':
        return <CheckCircle size={13} className="text-success flex-shrink-0" />
      case 'error':
        return <AlertTriangle size={13} className="text-warning flex-shrink-0" />
      default:
        return <Activity size={13} className="text-cyan flex-shrink-0" />
    }
  }

  function getEventTextClass(type: MonitorEvent['eventType']) {
    switch (type) {
      case 'detected': return 'text-danger'
      case 'clean': return 'text-success'
      case 'error': return 'text-warning'
      default: return 'text-cyan'
    }
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Activity size={20} className="text-cyan" />
          <h1 className="text-xl font-mono font-bold text-white tracking-wide">
            Realtime Monitor
          </h1>
        </div>
        <p className="text-sm text-gray-500 font-mono">
          Watch a directory for new files and scan them automatically
        </p>
      </div>

      {/* Status banner */}
      <div
        className={`glass-card px-5 py-4 flex items-center gap-4 transition-all duration-500 ${
          isMonitoring
            ? 'border border-success/30'
            : 'border border-white/5'
        }`}
        style={
          isMonitoring
            ? { background: 'rgba(0,255,136,0.04)', boxShadow: '0 0 20px rgba(0,255,136,0.06)' }
            : undefined
        }
      >
        <div className="relative flex items-center justify-center w-10 h-10 flex-shrink-0">
          {isMonitoring ? (
            <>
              <div className="w-10 h-10 rounded-full bg-success/10 border border-success/30 flex items-center justify-center">
                <Activity size={18} className="text-success" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-success animate-pulse" />
            </>
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Activity size={18} className="text-gray-500" />
            </div>
          )}
        </div>
        <div>
          <p className="font-mono font-semibold text-sm text-white">
            Monitor Status:{' '}
            <span className={isMonitoring ? 'text-success neon-green' : 'text-gray-500'}>
              {isMonitoring ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </p>
          {isMonitoring && (
            <p className="font-mono text-xs text-gray-500 mt-0.5">
              Watching: <span className="text-cyan">{directory}</span>
            </p>
          )}
        </div>
        <div className="ml-auto font-mono text-xs text-gray-600 flex items-center gap-1.5">
          <Clock size={11} />
          {new Date().toLocaleTimeString('en-US', { hour12: false })}
        </div>
      </div>

      {/* Control panel */}
      <div className="glass-card p-6 space-y-5">
        <h2 className="font-mono font-semibold text-white text-sm flex items-center gap-2">
          <FolderOpen size={15} className="text-cyan" />
          Monitor Configuration
        </h2>

        <div className="space-y-2">
          <label className="font-mono text-xs text-gray-500 uppercase tracking-wider">
            Directory Path
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={directory}
              onChange={(e) => setDirectory(e.target.value)}
              placeholder="/home/user/downloads"
              disabled={isMonitoring || loading}
              className="input-dark font-mono text-sm flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {!isMonitoring ? (
              <button
                onClick={handleStart}
                disabled={loading || !directory.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl font-mono text-sm font-semibold
                  bg-success/10 hover:bg-success/20 text-success border border-success/30
                  transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0
                  hover:shadow-[0_0_15px_rgba(0,255,136,0.2)]"
              >
                <Play size={14} className="fill-current" />
                {loading ? 'Starting…' : 'Start'}
              </button>
            ) : (
              <button
                onClick={handleStop}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl font-mono text-sm font-semibold
                  bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30
                  transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0
                  hover:shadow-[0_0_15px_rgba(255,51,102,0.2)]"
              >
                <Square size={14} className="fill-current" />
                {loading ? 'Stopping…' : 'Stop'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div
            className="px-4 py-3 rounded-xl border border-danger/30 font-mono text-sm text-danger"
            style={{ background: 'rgba(255,51,102,0.06)' }}
          >
            {error}
          </div>
        )}

        {/* Info chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            'Scans new files automatically',
            'Real-time threat detection',
            'Heuristic analysis enabled',
          ].map((info) => (
            <span
              key={info}
              className="font-mono text-xs text-cyan/60 bg-cyan/5 border border-cyan/10 px-3 py-1 rounded-full"
            >
              {info}
            </span>
          ))}
        </div>
      </div>

      {/* Event log */}
      <div className="glass-card overflow-hidden">
        <div
          className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: 'rgba(0,212,255,0.08)' }}
        >
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-cyan" />
            <h2 className="font-mono font-semibold text-white text-sm">
              Event Log
            </h2>
            {events.length > 0 && (
              <span className="font-mono text-xs text-cyan bg-cyan/10 border border-cyan/20 px-2 py-0.5 rounded-full">
                {events.length}
              </span>
            )}
          </div>
          {events.length > 0 && (
            <button
              onClick={clearLog}
              className="font-mono text-xs text-gray-500 hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div
          className="overflow-y-auto"
          style={{
            height: '320px',
            fontFamily: 'JetBrains Mono, monospace',
            background: 'rgba(0,0,0,0.3)',
          }}
        >
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-3">
                <Activity size={20} className="text-gray-700" />
              </div>
              <p className="font-mono text-sm text-gray-600">No events yet.</p>
              <p className="font-mono text-xs text-gray-700 mt-1">
                Start monitoring a directory to see activity here.
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-0.5">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors"
                >
                  {getEventIcon(event.eventType)}
                  <span className="text-gray-600 text-[11px] flex-shrink-0 tabular-nums">
                    {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                  <span className={`text-[11px] leading-relaxed ${getEventTextClass(event.eventType)}`}>
                    {event.message}
                    {event.path && event.eventType !== 'info' && (
                      <span className="text-gray-500 ml-1">— {event.path}</span>
                    )}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">
            Total Events
          </p>
          <p className="text-2xl font-mono font-bold text-cyan">{events.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">
            Threats
          </p>
          <p className="text-2xl font-mono font-bold text-danger">
            {events.filter((e) => e.eventType === 'detected').length}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">
            Clean
          </p>
          <p className="text-2xl font-mono font-bold text-success">
            {events.filter((e) => e.eventType === 'clean').length}
          </p>
        </div>
      </div>
    </div>
  )
}
