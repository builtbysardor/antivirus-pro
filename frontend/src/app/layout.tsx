'use client'

import './globals.css'
import { useState } from 'react'
import { Shield, Menu } from 'lucide-react'
import Sidebar from './Sidebar'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <html lang="en">
      <head>
        <title>Antivirus Pro</title>
        <meta name="description" content="Production-grade antivirus scanner" />
      </head>
      <body
        className="font-sans antialiased"
        style={{ backgroundColor: '#020203', color: '#e0e0f0', minHeight: '100vh' }}
      >
        {/* Responsive sidebar */}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Top header */}
        <div
          className="fixed top-0 right-0 z-10 flex items-center justify-between px-4 md:px-6 py-4 h-16"
          style={{
            left: 0,
            backgroundColor: 'rgba(2,2,3,0.9)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(5,255,133,0.08)',
          }}
        >
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden text-gray-400 hover:text-white transition-colors mr-3"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-2 md:ml-60">
            <Shield size={18} className="text-cyan" />
            <span className="font-mono font-bold text-white tracking-wide">
              Antivirus Pro
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/25">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="font-mono text-xs text-success font-semibold tracking-wide">
              Engine: Active
            </span>
          </div>
        </div>

        {/* Main content — offset on desktop, full-width on mobile */}
        <main className="min-h-screen pt-16 md:ml-60">
          {children}
        </main>
      </body>
    </html>
  )
}
