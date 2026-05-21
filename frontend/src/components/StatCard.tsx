import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  trend?: number
  color?: 'cyan' | 'success' | 'danger' | 'warning'
  loading?: boolean
}

const colorMap = {
  cyan: {
    icon: 'text-cyan',
    iconBg: 'bg-cyan/10',
    border: 'border-cyan/20',
    glow: 'hover:shadow-[0_0_20px_rgba(0,212,255,0.15)]',
    value: 'text-cyan',
  },
  success: {
    icon: 'text-success',
    iconBg: 'bg-success/10',
    border: 'border-success/20',
    glow: 'hover:shadow-[0_0_20px_rgba(0,255,136,0.15)]',
    value: 'text-success',
  },
  danger: {
    icon: 'text-danger',
    iconBg: 'bg-danger/10',
    border: 'border-danger/20',
    glow: 'hover:shadow-[0_0_20px_rgba(255,51,102,0.15)]',
    value: 'text-danger',
  },
  warning: {
    icon: 'text-warning',
    iconBg: 'bg-warning/10',
    border: 'border-warning/20',
    glow: 'hover:shadow-[0_0_20px_rgba(255,170,0,0.15)]',
    value: 'text-warning',
  },
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'cyan',
  loading = false,
}: StatCardProps) {
  const colors = colorMap[color]
  const isPositiveTrend = trend !== undefined && trend >= 0

  return (
    <div
      className={`
        glass-card p-5 transition-all duration-300 cursor-default
        ${colors.border} ${colors.glow}
        animate-fade-in
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-mono text-gray-500 tracking-widest uppercase mb-2">
            {title}
          </p>
          {loading ? (
            <div className="skeleton h-8 w-24 rounded" />
          ) : (
            <p
              className={`text-3xl font-mono font-bold ${colors.value} tracking-tight`}
              style={{ textShadow: `0 0 20px currentColor` }}
            >
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          )}

          {trend !== undefined && !loading && (
            <div
              className={`flex items-center gap-1 mt-2 text-xs font-mono ${
                isPositiveTrend ? 'text-success' : 'text-danger'
              }`}
            >
              {isPositiveTrend ? (
                <TrendingUp size={12} />
              ) : (
                <TrendingDown size={12} />
              )}
              <span>
                {isPositiveTrend ? '+' : ''}
                {trend.toFixed(1)}% vs last week
              </span>
            </div>
          )}
        </div>

        <div
          className={`
            flex items-center justify-center w-12 h-12 rounded-xl
            ${colors.iconBg} ${colors.border} border
          `}
        >
          <Icon size={22} className={colors.icon} />
        </div>
      </div>
    </div>
  )
}
