'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { LiftSummary } from '@/lib/liftHistory'

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
}

function LiftCard({ s }: { s: LiftSummary }) {
  const unit = s.perDumbbell ? 'lb/DB' : 'lb'
  const first = s.points[0]
  const change = first && s.latest ? s.latest.e1rm - first.e1rm : 0
  const data = s.points.map(p => ({ ...p, label: shortDate(p.date) }))
  const values = s.points.map(p => p.e1rm).concat(s.savedMax ? [s.savedMax] : [])
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = Math.max(5, Math.round((hi - lo) * 0.15))

  return (
    <Card className={s.newPR ? 'border-amber-500/40' : ''}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>{s.label}</CardTitle>
          <p className="text-xs text-zinc-500 mt-0.5">
            {s.points.length} workout{s.points.length === 1 ? '' : 's'} logged{s.perDumbbell ? ' · per dumbbell' : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-blue-400 tabular-nums">{s.latest?.e1rm}</p>
          <p className="text-[11px] text-zinc-500">est. max ({unit})</p>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {s.newPR && s.latest && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm text-amber-300">
            <Trophy className="w-4 h-4 shrink-0" />
            New PR: {s.latest.weight} × {s.latest.reps} on {shortDate(s.latest.date)} (est. max {s.latest.e1rm} {unit})
          </div>
        )}

        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis
                domain={[Math.max(0, lo - pad), hi + pad]}
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(v: number, _n: string, item: any) => [
                  `${v} ${unit} (best set ${item?.payload?.weight} × ${item?.payload?.reps})`,
                  'Est. max',
                ]}
              />
              {s.savedMax && (
                <ReferenceLine
                  y={s.savedMax}
                  stroke="#a1a1aa"
                  strokeDasharray="4 4"
                  label={{ value: `Saved max ${s.savedMax}`, fill: '#a1a1aa', fontSize: 10, position: 'insideTopLeft' }}
                />
              )}
              <Line
                type="monotone"
                dataKey="e1rm"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-zinc-500 text-center py-4">Log this lift in another workout to see a trend.</p>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-zinc-800/50 px-2 py-2">
            <p className="text-[11px] text-zinc-500">Best set</p>
            <p className="text-sm font-semibold text-white">{s.heaviest ? `${s.heaviest.weight} × ${s.heaviest.reps}` : '—'}</p>
          </div>
          <div className="rounded-lg bg-zinc-800/50 px-2 py-2">
            <p className="text-[11px] text-zinc-500">Best est. max</p>
            <p className="text-sm font-semibold text-white">{s.best ? `${s.best.e1rm}` : '—'}</p>
          </div>
          <div className="rounded-lg bg-zinc-800/50 px-2 py-2">
            <p className="text-[11px] text-zinc-500">Change</p>
            <p className={`text-sm font-semibold flex items-center justify-center gap-1 ${change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-white'}`}>
              {change > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : change < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : null}
              {s.points.length > 1 ? `${change > 0 ? '+' : ''}${change}` : '—'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function LiftProgress({ lifts, emptyText }: { lifts: LiftSummary[]; emptyText: string }) {
  const withData = lifts.filter(l => l.points.length > 0)
  if (withData.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-zinc-500">{emptyText}</CardContent>
      </Card>
    )
  }
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {withData.map(s => <LiftCard key={s.lift} s={s} />)}
    </div>
  )
}
