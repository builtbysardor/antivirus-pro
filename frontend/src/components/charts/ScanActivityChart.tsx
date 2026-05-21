"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface DayData {
  date: string
  count: number
}

interface Props {
  data: DayData[]
}

interface TooltipPayload {
  value: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    return (
      <div
        className="rounded-xl px-3 py-2 font-mono text-xs"
        style={{
          background: 'rgba(9,9,11,0.95)',
          border: '1px solid rgba(5,255,133,0.25)',
          color: '#e0e0f0',
        }}
      >
        <p className="text-gray-400 mb-0.5">{label}</p>
        <p style={{ color: '#05ff85' }}>
          {payload[0].value} scan{payload[0].value !== 1 ? 's' : ''}
        </p>
      </div>
    )
  }
  return null
}

export default function ScanActivityChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(5,255,133,0.07)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: 'rgba(0,255,136,0.05)' }}
        />
        <Bar
          dataKey="count"
          fill="#00ff88"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
