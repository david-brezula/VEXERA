"use client"

import { ResponsiveContainer } from "recharts"

interface ChartWrapperProps {
  children: React.ReactNode
  height?: number
}

export function ChartWrapper({ children, height = 350 }: ChartWrapperProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  )
}
