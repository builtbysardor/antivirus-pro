"use client"

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface SliceData {
  name: string
  value: number
}

interface Props {
  clean: number
  suspicious: number
  malicious: number
}

const COLORS: Record<string, string> = {
  Clean: '#00ff88',
  Suspicious: '#ffaa00',
  Malicious: '#ff0044',
}

interface TooltipPayload {
  name: string
  value: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    const item = payload[0]
    return (
      <div
        className="rounded-xl px-3 py-2 font-mono text-xs"
        style={{
          background: 'rgba(13,13,26,0.95)',
          border: `1px solid ${COLORS[item.name] ?? '#444'}40`,
          color: '#e0e0f0',
        }}
      >
        <p style={{ color: COLORS[item.name] ?? '#e0e0f0' }}>
          {item.name}: {item.value}
        </p>
      </div>
    )
  }
  return null
}

export default function ThreatDistributionChart({ clean, suspicious, malicious }: Props) {
  const data: SliceData[] = [
    { name: 'Clean', value: clean },
    { name: 'Suspicious', value: suspicious },
    { name: 'Malicious', value: malicious },
  ].filter((d) => d.value > 0)

  const allZero = data.length === 0

  if (allZero) {
    return (
      <div className="flex items-center justify-center h-[220px]">
        <p className="font-mono text-sm text-gray-600">No scan data yet</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={COLORS[entry.name] ?? '#888'}
              opacity={0.9}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span
              className="font-mono text-xs"
              style={{ color: '#9ca3af' }}
            >
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
