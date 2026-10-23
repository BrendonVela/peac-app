'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, Printer, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { GroupsBar } from '@/components/groups/GroupsBar'
import type { Group } from '@/app/actions/groups'
import { cn } from '@/lib/utils'

export interface ReportRow {
  athleteId: string
  name: string
  signedUp: boolean
  hasProgram: boolean
  due: number
  done: number
  partial: number
  missed: number
  compliance: number | null
  checkIns: number
  avgReadiness: number | null
  avgRpe: number | null
  load: number
  lastActive: string | null
}

function pctColor(p: number | null) {
  if (p === null) return 'text-zinc-500'
  if (p >= 80) return 'text-green-400'
  if (p >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function shortDate(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
}

export function ReportView({ rows, days, periods, from, to }: { rows: ReportRow[]; days: number; periods: number[]; from: string; to: string }) {
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [sort, setSort] = useState<'compliance' | 'name'>('compliance')

  const shown = useMemo(() => {
    const allowed = groupId ? new Set(groups.find(g => g.id === groupId)?.athleteIds ?? []) : null
    const r = rows.filter(x => !allowed || allowed.has(x.athleteId))
    return [...r].sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : (a.compliance ?? 101) - (b.compliance ?? 101) || a.name.localeCompare(b.name)
    )
  }, [rows, groupId, groups, sort])

  const totalDue = shown.reduce((n, r) => n + r.due, 0)
  const totalDone = shown.reduce((n, r) => n + r.done, 0)
  const teamPct = totalDue ? Math.round((totalDone / totalDue) * 100) : null
  const behind = shown.filter(r => r.compliance !== null && r.compliance < 50)
  const noProgram = shown.filter(r => !r.hasProgram)

  function exportCsv() {
    const header = ['Athlete', 'Signed up', 'Scheduled', 'Done', 'In progress', 'Missed', 'Done %', 'Check-ins', 'Avg readiness', 'Avg RPE', 'Load', 'Last logged']
    const lines = shown.map(r => [
      r.name, r.signedUp ? 'Yes' : 'No', r.due, r.done, r.partial, r.missed,
      r.compliance ?? '', r.checkIns, r.avgReadiness ?? '', r.avgRpe ?? '', r.load || '', r.lastActive ?? '',
    ])
    const csv = [header, ...lines].map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `peac-report-${from}-to-${to}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {periods.map(p => (
          <Link
            key={p}
            href={`/coach/reports?days=${p}`}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-medium', p === days ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-zinc-700 text-zinc-400 hover:text-white')}
          >
            Last {p} days
          </Link>
        ))}
        <div className="flex-1" />
        <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:text-white">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:text-white">
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
      </div>

      <div className="print:hidden"><GroupsBar athletes={rows.map(r => ({ id: r.athleteId, name: r.name }))} selected={groupId} onSelect={setGroupId} onGroups={setGroups} readOnly /></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="py-4">
          <p className={cn('text-2xl font-bold', pctColor(teamPct))}>{teamPct ?? '—'}{teamPct !== null && '%'}</p>
          <p className="text-xs text-zinc-500">Team workouts done</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-2xl font-bold text-white">{totalDone}<span className="text-zinc-500 text-base">/{totalDue}</span></p>
          <p className="text-xs text-zinc-500">Workouts done / scheduled</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className={cn('text-2xl font-bold', behind.length ? 'text-red-400' : 'text-green-400')}>{behind.length}</p>
          <p className="text-xs text-zinc-500">Athletes under 50%</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className={cn('text-2xl font-bold', noProgram.length ? 'text-amber-400' : 'text-white')}>{noProgram.length}</p>
          <p className="text-xs text-zinc-500">No program assigned</p>
        </CardContent></Card>
      </div>

      <p className="text-xs text-zinc-500">{shortDate(from)} – {shortDate(to)} · only workouts scheduled up to today count.</p>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3 cursor-pointer" onClick={() => setSort('name')}>Athlete</th>
                <th className="text-right px-3 py-3 cursor-pointer" onClick={() => setSort('compliance')}>Done %</th>
                <th className="text-right px-3 py-3">Done</th>
                <th className="text-right px-3 py-3">Missed</th>
                <th className="text-right px-3 py-3">Check-ins</th>
                <th className="text-right px-3 py-3">Readiness</th>
                <th className="text-right px-3 py-3">Avg RPE</th>
                <th className="text-right px-3 py-3">Load</th>
                <th className="text-right px-4 py-3">Last logged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {shown.map(r => (
                <tr key={r.athleteId} className="hover:bg-zinc-800/30">
                  <td className="px-4 py-2.5">
                    <Link href={`/coach/athletes/${r.athleteId}`} className="text-white hover:text-blue-300">{r.name}</Link>
                    {!r.signedUp && <span className="ml-2 text-[10px] text-amber-300">Not signed up</span>}
                    {!r.hasProgram && <span className="ml-2 text-[10px] text-zinc-500">No program</span>}
                  </td>
                  <td className={cn('px-3 py-2.5 text-right font-semibold tabular-nums', pctColor(r.compliance))}>
                    {r.compliance === null ? '—' : `${r.compliance}%`}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">
                    {r.done}/{r.due}{r.partial > 0 && <span className="text-blue-400"> +{r.partial}</span>}
                  </td>
                  <td className={cn('px-3 py-2.5 text-right tabular-nums', r.missed ? 'text-red-400' : 'text-zinc-500')}>{r.missed}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{r.checkIns}/{days}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{r.avgReadiness ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{r.avgRpe ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{r.load || '—'}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-400">{shortDate(r.lastActive)}</td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-500">No athletes{groupId ? ' in this group' : ''}.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {behind.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-zinc-400 print:hidden">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          Behind: {behind.map(b => b.name.split(' ')[0]).join(', ')}. Tap a name to open their page, or send a reminder from Messages.
        </p>
      )}
    </div>
  )
}
