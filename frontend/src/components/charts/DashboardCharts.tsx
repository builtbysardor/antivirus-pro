"use client"

import { BarChart2 } from "lucide-react"
import ScanActivityChart from "./ScanActivityChart"
import ThreatDistributionChart from "./ThreatDistributionChart"

interface DayData {
  date: string
  count: number
}

interface Props {
  scanActivityData: DayData[]
  clean: number
  suspicious: number
  malicious: number
}

export default function DashboardCharts({
  scanActivityData,
  clean,
  suspicious,
  malicious,
}: Props) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={18} className="text-cyan" />
        <h2 className="font-mono font-semibold text-white text-sm tracking-wide">
          Analytics
        </h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scan Activity */}
        <div className="glass-card p-5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-4">
            Scan Activity — Last 7 Days
          </p>
          <ScanActivityChart data={scanActivityData} />
        </div>

        {/* Threat Distribution */}
        <div className="glass-card p-5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-4">
            Threat Distribution
          </p>
          <ThreatDistributionChart
            clean={clean}
            suspicious={suspicious}
            malicious={malicious}
          />
        </div>
      </div>
    </div>
  )
}
