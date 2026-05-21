"use client"

interface Props {
  clean: number
  suspicious: number
  malicious: number
}

const COLORS: Record<string, string> = {
  Clean: '#05ff85',
  Suspicious: '#ffaa00',
  Malicious: '#ff0044',
}

const GLOWS: Record<string, string> = {
  Clean: 'shadow-[0_0_12px_rgba(5,255,133,0.45)]',
  Suspicious: 'shadow-[0_0_12px_rgba(255,170,0,0.45)]',
  Malicious: 'shadow-[0_0_12px_rgba(255,0,68,0.45)]',
}

export default function ThreatDistributionChart({ clean, suspicious, malicious }: Props) {
  const total = clean + suspicious + malicious

  const items = [
    {
      name: 'Clean Files',
      value: clean,
      color: COLORS.Clean,
      glow: GLOWS.Clean,
      bg: 'rgba(5,255,133,0.02)',
      border: 'border-[rgba(5,255,133,0.08)] hover:border-[rgba(5,255,133,0.25)]',
    },
    {
      name: 'Suspicious Threats',
      value: suspicious,
      color: COLORS.Suspicious,
      glow: GLOWS.Suspicious,
      bg: 'rgba(255,170,0,0.02)',
      border: 'border-[rgba(255,170,0,0.08)] hover:border-[rgba(255,170,0,0.25)]',
    },
    {
      name: 'Malicious Threats',
      value: malicious,
      color: COLORS.Malicious,
      glow: GLOWS.Malicious,
      bg: 'rgba(255,0,68,0.02)',
      border: 'border-[rgba(255,0,68,0.08)] hover:border-[rgba(255,0,68,0.25)]',
    },
  ]

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[220px]">
        <p className="font-mono text-sm text-gray-600">No scan data yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col justify-center gap-3.5 h-[220px] py-1">
      {items.map((item) => {
        const percent = total > 0 ? (item.value / total) * 100 : 0
        return (
          <div
            key={item.name}
            style={{ backgroundColor: item.bg }}
            className={`border rounded-xl p-3 flex flex-col gap-2 transition-all duration-300 group ${item.border}`}
          >
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-gray-400 font-medium tracking-wide group-hover:text-white transition-colors">
                {item.name}
              </span>
              <span
                className="font-bold px-2 py-0.5 rounded-md text-[10px]"
                style={{
                  color: item.color,
                  backgroundColor: `${item.color}15`,
                  border: `1px solid ${item.color}25`
                }}
              >
                {item.value} ({percent.toFixed(1)}%)
              </span>
            </div>
            
            {/* Progress Track */}
            <div className="w-full h-2 bg-black/45 rounded-full overflow-hidden border border-white/5 relative">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out relative ${item.glow}`}
                style={{
                  width: `${percent}%`,
                  backgroundColor: item.color,
                  boxShadow: `0 0 10px ${item.color}80`
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
