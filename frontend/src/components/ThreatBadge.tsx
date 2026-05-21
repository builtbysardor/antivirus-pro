'use client'

import { Shield, AlertTriangle, Skull, HelpCircle, CheckCircle } from 'lucide-react'

type ThreatLevel = 'clean' | 'suspicious' | 'malicious' | 'unknown'

interface ThreatBadgeProps {
  level: ThreatLevel
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  showLabel?: boolean
  animate?: boolean
}

const configs: Record<
  ThreatLevel,
  {
    label: string
    Icon: React.ComponentType<any>
    className: string
    iconClass: string
  }
> = {
  clean: {
    label: 'CLEAN',
    Icon: CheckCircle,
    className:
      'bg-success/10 text-success border border-success/30 shadow-[0_0_8px_rgba(0,255,136,0.15)]',
    iconClass: 'text-success',
  },
  suspicious: {
    label: 'SUSPICIOUS',
    Icon: AlertTriangle,
    className:
      'bg-warning/10 text-warning border border-warning/30 shadow-[0_0_8px_rgba(255,170,0,0.15)]',
    iconClass: 'text-warning',
  },
  malicious: {
    label: 'MALICIOUS',
    Icon: Skull,
    className:
      'bg-danger/10 text-danger border border-danger/30 shadow-[0_0_8px_rgba(255,51,102,0.15)] animate-threat-flash',
    iconClass: 'text-danger',
  },
  unknown: {
    label: 'UNKNOWN',
    Icon: HelpCircle,
    className:
      'bg-gray-800/50 text-gray-400 border border-gray-600/30',
    iconClass: 'text-gray-400',
  },
}

const sizeClasses = {
  sm: { wrapper: 'px-2 py-0.5 text-[10px] gap-1', iconSize: 10 },
  md: { wrapper: 'px-3 py-1 text-xs gap-1.5', iconSize: 12 },
  lg: { wrapper: 'px-4 py-1.5 text-sm gap-2', iconSize: 14 },
}

export default function ThreatBadge({
  level,
  size = 'md',
  showIcon = true,
  showLabel = true,
  animate = false,
}: ThreatBadgeProps) {
  const normalizedLevel: ThreatLevel =
    level && configs[level] ? level : 'unknown'
  const config = configs[normalizedLevel]
  const { wrapper, iconSize } = sizeClasses[size]
  const { Icon, label, className, iconClass } = config

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-mono font-semibold tracking-wider
        ${wrapper}
        ${className}
        ${animate && normalizedLevel === 'malicious' ? 'animate-threat-flash' : ''}
      `}
    >
      {showIcon && (
        <Icon size={iconSize} className={iconClass} />
      )}
      {showLabel && <span>{label}</span>}
    </span>
  )
}
