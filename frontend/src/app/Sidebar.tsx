'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Shield,
  AlertTriangle,
  Activity,
  Settings,
  Menu,
  X,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/scan', label: 'Scan', Icon: Shield },
  { href: '/threats', label: 'Threats', Icon: AlertTriangle },
  { href: '/monitor', label: 'Monitor', Icon: Activity },
  { href: '/settings', label: 'Settings', Icon: Settings },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 h-full w-60 flex flex-col z-40
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
        style={{
          backgroundColor: '#09090b',
          borderRight: '1px solid rgba(5,255,133,0.08)',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-5 border-b"
          style={{ borderColor: 'rgba(5,255,133,0.08)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan/10 border border-cyan/30 flex items-center justify-center flex-shrink-0">
              <Shield size={16} className="text-cyan" />
            </div>
            <span className="font-mono font-bold text-white text-sm tracking-wide">
              Antivirus Pro
            </span>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="md:hidden text-gray-400 hover:text-white transition-colors"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, Icon }) => {
            const isActive =
              href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl font-mono text-sm
                  transition-all duration-200 group
                    ${
                      isActive
                        ? 'bg-cyan/10 text-cyan border border-cyan/20 shadow-[0_0_12px_rgba(5,255,133,0.15)]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }
                `}
              >
                <Icon
                  size={16}
                  className={
                    isActive
                      ? 'text-cyan'
                      : 'text-gray-500 group-hover:text-gray-300 transition-colors'
                  }
                />
                <span>{label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan animate-pulse-glow" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div
          className="px-4 py-4 border-t"
          style={{ borderColor: 'rgba(5,255,133,0.08)' }}
        >
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-success/5 border border-success/20">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse flex-shrink-0" />
            <span className="font-mono text-xs text-success">Engine Active</span>
          </div>
        </div>
      </aside>
    </>
  )
}

export { Menu }
