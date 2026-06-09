'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { format } from 'date-fns'

interface Props {
  data: { date: string; value: number }[]
  unit: string
  higherIsBetter: boolean
}

export function PerformanceChart({ data, unit, higherIsBetter }: Props) {
  const first = data[0]?.value ?? 0
  const last = data[data.length - 1]?.value ?? 0
  const color = higherIsBetter
    ? last > first ? '#4ade80' : '#f87171'
    : last < first ? '#4ade80' : '#f87171'

  const formatted = data.map(d => ({
    date: format(new Date(d.date), 'MMM d'),
    value: d.value,
  }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={formatted}>
        <XAxis
          dataKey="date"
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v}${unit}`}
          width={50}
        />
        <Tooltip
          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#a1a1aa' }}
          formatter={(v: number) => [`${v} ${unit}`, 'Result']}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
