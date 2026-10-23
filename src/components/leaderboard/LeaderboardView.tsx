'use client'

import { useMemo, useState } from 'react'
import { Trophy, Medal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { GroupsBar } from '@/components/groups/GroupsBar'
import type { Group } from '@/app/actions/groups'
import type { Metric } from '@/lib/leaderboard'
import { cn } from '@/lib/utils'

function fmt(v: number, unit: string) {
  const n = unit === 'sec' ? v.toFixed(2) : Number.isInteger(v) ? String(v) : v.toFixed(1)
  return `${n} ${unit}`
}

function shortDate(iso: string | null) {
  if (!iso) return ''
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
}

export function LeaderboardView({
  metrics,
  athletes,
  meId = null,
  showGroups = false,
}: {
  metrics: Metric[]
  athletes: { id: string; name: string }[]
  meId?: string | null
  showGroups?: boolean
}) {
  const withData = metrics.filter(m => m.rows.length > 0)
  const [key, setKey] = useState(withData[0]?.key ?? metrics[0]?.key)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groups, setGroups] = useState<Group[]>([])

  const allowed = useMemo(() => {
    if (!groupId) return null
    return new Set(groups.find(g => g.id === groupId)?.athleteIds ?? [])
  }, [groupId, groups])

  const filter = (m: Metric) => (allowed ? m.rows.filter(r => allowed.has(r.athleteId)) : m.rows)
  const metric = metrics.find(m => m.key === key)
  const rows = metric ? filter(metric) : []

  if (withData.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <Trophy className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-sm text-zinc-400">No numbers yet.</p>
          <p className="text-xs text-zinc-500">The leaderboard fills in as athletes log their main lifts and coaches add test results and maxes.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {showGroups && <GroupsBar athletes={athletes} selected={groupId} onSelect={setGroupId} onGroups={setGroups} readOnly />}

      {/* Team records */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-400" /> Team records</CardTitle></CardHeader>
        <CardContent className="pt-0 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {withData.map(m => {
            const top = filter(m)[0]
            return (
              <button
                key={m.key}
                onClick={() => setKey(m.key)}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-left transition-colors',
                  key === m.key ? 'border-amber-500/60 bg-amber-500/10' : 'border-zinc-800 bg-zinc-800/30 hover:border-zinc-700'
                )}
              >
                <p className="text-[11px] uppercase tracking-wide text-zinc-500 truncate">{m.label}</p>
                {top ? (
                  <>
                    <p className="text-lg font-bold text-white">{fmt(top.value, m.unit)}</p>
                    <p className={cn('text-xs truncate', top.athleteId === meId ? 'text-blue-400' : 'text-zinc-400')}>{top.name}</p>
                  </>
                ) : (
                  <p className="text-sm text-zinc-600 mt-1">—</p>
                )}
              </button>
            )
          })}
        </CardContent>
      </Card>

      {/* Metric picker */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {metrics.map(m => (
          <button
            key={m.key}
            onClick={() => setKey(m.key)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium',
              key === m.key ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-zinc-700 text-zinc-400 hover:text-white',
              m.rows.length === 0 && 'opacity-40'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Ranking */}
      {metric && (
        <Card>
          <CardHeader>
            <CardTitle>{metric.label}</CardTitle>
            <p className="text-xs text-zinc-500 mt-1">
              {metric.kind === 'lift'
                ? 'Best estimated 1-rep max from logged sets, or the max the coach entered — whichever is higher.'
                : metric.higherIsBetter ? 'Best result — higher is better.' : 'Best time — lower is better.'}
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            {rows.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4">No results yet{allowed ? ' for this group' : ''}.</p>
            ) : (
              <div className="divide-y divide-zinc-800">
                {rows.map((r, i) => (
                  <div key={r.athleteId} className={cn('flex items-center gap-3 py-2.5', r.athleteId === meId && 'bg-blue-600/10 -mx-2 px-2 rounded-lg')}>
                    <span className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      i === 0 ? 'bg-amber-400 text-black' : i === 1 ? 'bg-zinc-300 text-black' : i === 2 ? 'bg-orange-700 text-white' : 'bg-zinc-800 text-zinc-400'
                    )}>
                      {i < 3 ? <Medal className="w-4 h-4" /> : i + 1}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={cn('block text-sm truncate', r.athleteId === meId ? 'text-blue-300 font-semibold' : 'text-white')}>
                        {r.name}{r.athleteId === meId && ' (you)'}
                      </span>
                      <span className="block text-[11px] text-zinc-500">
                        {shortDate(r.date)}{r.source === 'est' ? ' · from logged sets' : r.source === 'max' ? ' · tested max' : ''}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-white tabular-nums">{fmt(r.value, metric.unit)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
