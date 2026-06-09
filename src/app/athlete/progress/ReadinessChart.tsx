'use client'

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'

interface Props {
  data: { date: string; score: number }[]
}

export function ReadinessChart({ data }: Props) {
  const formatted = data.map(d => ({
    date: format(new Date(d.date), 'MMM d'),
    score: parseFloat(d.score.toFixed(1)),
  }))

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={formatted}>
        <defs>
          <linearGradient id="readinessGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 10]}
          tick={{ fill: '#71717a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={25}
        />
        <Tooltip
          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#a1a1aa' }}
          formatter={(v: number) => [v, 'Readiness']}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#2563eb"
          strokeWidth={2}
          fill="url(#readinessGrad)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: '#2563eb' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
