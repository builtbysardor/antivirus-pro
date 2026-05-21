'use client'

import { useState, useEffect } from 'react'
import { Settings, Key, Archive, Bell, Save, CheckCircle, AlertTriangle, Eye, EyeOff, Shield } from 'lucide-react'

interface AppSettings {
  virustotalApiKey: string
  cloudScanningEnabled: boolean
  quarantinePath: string
  notificationsEnabled: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  virustotalApiKey: '',
  cloudScanningEnabled: false,
  quarantinePath: '/var/quarantine',
  notificationsEnabled: true,
}

const STORAGE_KEY = 'antivirus-pro-settings'

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function Toggle({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer group py-1">
      <div>
        <p className="font-mono text-sm text-white group-hover:text-cyan transition-colors">
          {label}
        </p>
        {description && (
          <p className="font-mono text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-all duration-200
          focus:outline-none
          ${
            enabled
              ? 'bg-cyan/30 border-cyan/60 shadow-[0_0_8px_rgba(0,212,255,0.3)]'
              : 'bg-white/5 border-white/10'
          }
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 rounded-full transition-transform duration-200 mt-0.5
            ${enabled ? 'translate-x-5 bg-cyan shadow-[0_0_6px_rgba(0,212,255,0.8)]' : 'translate-x-0.5 bg-gray-500'}
          `}
        />
      </button>
    </label>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [showApiKey, setShowApiKey] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Load from localStorage on mount (client-only)
  useEffect(() => {
    setSettings(loadSettings())
    setHasLoaded(true)
  }, [])

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    if (saveStatus !== 'idle') setSaveStatus('idle')
  }

  function handleSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      setSaveStatus('saved')
      const t = setTimeout(() => setSaveStatus('idle'), 3000)
      return () => clearTimeout(t)
    } catch {
      setSaveStatus('error')
    }
  }

  if (!hasLoaded) {
    return (
      <div className="p-6 space-y-4 animate-fade-in">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-64 w-full rounded-2xl" />
        <div className="skeleton h-48 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Settings size={20} className="text-cyan" />
          <h1 className="text-xl font-mono font-bold text-white tracking-wide">
            Settings
          </h1>
        </div>
        <p className="text-sm text-gray-500 font-mono">
          Configure scan engine, quarantine, and notifications
        </p>
      </div>

      {/* Engine Settings */}
      <section className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'rgba(0,212,255,0.08)' }}>
          <div className="w-8 h-8 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center">
            <Shield size={15} className="text-cyan" />
          </div>
          <div>
            <h2 className="font-mono font-semibold text-white text-sm">Engine Settings</h2>
            <p className="font-mono text-xs text-gray-500">Scan engine and cloud analysis configuration</p>
          </div>
        </div>

        {/* VirusTotal API Key */}
        <div className="space-y-2">
          <label className="font-mono text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Key size={11} />
            VirusTotal API Key
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={settings.virustotalApiKey}
              onChange={(e) => update('virustotalApiKey', e.target.value)}
              placeholder="Enter your VirusTotal API key…"
              className="input-dark font-mono text-sm pr-10"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="font-mono text-xs text-gray-600">
            Used for cloud-based threat intelligence lookups. Get one at{' '}
            <span className="text-cyan">virustotal.com</span>
          </p>
        </div>

        {/* Cloud scanning toggle */}
        <div className="pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          <Toggle
            enabled={settings.cloudScanningEnabled}
            onChange={(v) => update('cloudScanningEnabled', v)}
            label="Enable Cloud Scanning"
            description="Send file hashes to VirusTotal for multi-engine analysis"
          />
        </div>
      </section>

      {/* Quarantine Settings */}
      <section className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'rgba(0,212,255,0.08)' }}>
          <div className="w-8 h-8 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-center">
            <Archive size={15} className="text-warning" />
          </div>
          <div>
            <h2 className="font-mono font-semibold text-white text-sm">Quarantine Settings</h2>
            <p className="font-mono text-xs text-gray-500">Where detected threats are isolated</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="font-mono text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Archive size={11} />
            Quarantine Directory
          </label>
          <input
            type="text"
            value={settings.quarantinePath}
            onChange={(e) => update('quarantinePath', e.target.value)}
            placeholder="/var/quarantine"
            className="input-dark font-mono text-sm"
            spellCheck={false}
          />
          <p className="font-mono text-xs text-gray-600">
            Absolute path where quarantined files will be moved and isolated.
          </p>
        </div>
      </section>

      {/* Notification Settings */}
      <section className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'rgba(0,212,255,0.08)' }}>
          <div className="w-8 h-8 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center">
            <Bell size={15} className="text-success" />
          </div>
          <div>
            <h2 className="font-mono font-semibold text-white text-sm">Notifications</h2>
            <p className="font-mono text-xs text-gray-500">Alerts for scan results and threats</p>
          </div>
        </div>

        <Toggle
          enabled={settings.notificationsEnabled}
          onChange={(v) => update('notificationsEnabled', v)}
          label="Enable Notifications"
          description="Show browser notifications when threats are detected"
        />
      </section>

      {/* Save button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          className="btn-cyan font-mono flex items-center gap-2"
        >
          <Save size={15} />
          Save Settings
        </button>

        {saveStatus === 'saved' && (
          <div className="flex items-center gap-2 font-mono text-sm text-success animate-fade-in">
            <CheckCircle size={16} />
            Settings saved
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="flex items-center gap-2 font-mono text-sm text-danger animate-fade-in">
            <AlertTriangle size={16} />
            Failed to save
          </div>
        )}
      </div>

      {/* Version info */}
      <div className="pt-4 border-t" style={{ borderColor: 'rgba(0,212,255,0.06)' }}>
        <p className="font-mono text-xs text-gray-700">
          Antivirus Pro · Settings are stored in your browser&apos;s local storage
        </p>
      </div>
    </div>
  )
}
