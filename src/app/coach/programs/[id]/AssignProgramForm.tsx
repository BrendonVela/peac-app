'use client'

import { useEffect, useMemo, useState } from 'react'
import { Users, Search, Check, CalendarDays, X } from 'lucide-react'
import { listGroups, assignProgramToGroup, type Group } from '@/app/actions/groups'
import { cn, initials } from '@/lib/utils'
import { assignProgram, unassignProgram } from '@/app/actions/programs'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { todayISO, formatShortDate } from '@/lib/schedule'
import type { Athlete } from '@/types'

type Assignment = { athleteId: string; startDate: string; startWeek: number }

interface Props {
  programId: string
  athletes: Pick<Athlete, 'id' | 'name' | 'sport'>[]
  assignments: Assignment[]
  weeks: { n: number; label: string }[]
}

type Filter = 'all' | 'assigned' | 'open'

const inputCls = 'w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

export function AssignProgramForm({ programId, athletes, assignments, weeks }: Props) {
  const [assigned, setAssigned] = useState(() => new Map(assignments.map(a => [a.athleteId, a])))
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [groups, setGroups] = useState<Group[]>([])
  const [groupMsg, setGroupMsg] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  // The athlete being set up in the pop-up
  const [picked, setPicked] = useState<Pick<Athlete, 'id' | 'name' | 'sport'> | null>(null)
  const [date, setDate] = useState(todayISO())
  const [week, setWeek] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => { listGroups().then(setGroups) }, [])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return athletes.filter(a => {
      if (q && !a.name.toLowerCase().includes(q) && !(a.sport ?? '').toLowerCase().includes(q)) return false
      if (filter === 'assigned') return assigned.has(a.id)
      if (filter === 'open') return !assigned.has(a.id)
      return true
    })
  }, [athletes, query, filter, assigned])

  function open(a: Pick<Athlete, 'id' | 'name' | 'sport'>) {
    const cur = assigned.get(a.id)
    setPicked(a)
    setDate(cur?.startDate ?? todayISO())
    setWeek(cur?.startWeek ?? 1)
    setError('')
  }

  async function save() {
    if (!picked) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Pick a start date.'); return }
    setBusy(picked.id); setError('')
    const res = await assignProgram(programId, picked.id, date, week)
    setBusy(null)
    if (res && 'error' in res && res.error) { setError(res.error); return }
    setAssigned(prev => new Map(prev).set(picked.id, { athleteId: picked.id, startDate: date, startWeek: week }))
    setPicked(null)
  }

  async function remove() {
    if (!picked) return
    if (!confirm(`Remove ${picked.name} from this program? Their logged workouts stay saved.`)) return
    setBusy(picked.id)
    await unassignProgram(programId, picked.id)
    setBusy(null)
    setAssigned(prev => { const next = new Map(prev); next.delete(picked.id); return next })
    setPicked(null)
  }

  async function assignGroup(g: Group) {
    if (!confirm(`Assign this program to everyone in "${g.name}" (${g.athleteIds.length}), starting today?`)) return
    setBusy(`g-${g.id}`); setGroupMsg('')
    const res = await assignProgramToGroup(programId, g.id)
    setBusy(null)
    if ('error' in res && res.error) { setGroupMsg(res.error); return }
    if ('ids' in res && res.ids) {
      setAssigned(prev => {
        const next = new Map(prev)
        res.ids!.forEach(id => { if (!next.has(id)) next.set(id, { athleteId: id, startDate: todayISO(), startWeek: 1 }) })
        return next
      })
      setGroupMsg(`Assigned to ${res.added} new athlete${res.added === 1 ? '' : 's'} in ${g.name}.`)
    }
  }

  if (athletes.length === 0) {
    return <p className="text-sm text-zinc-500">Add athletes first to assign this program.</p>
  }

  const tab = (f: Filter, label: string, n: number) => (
    <button
      onClick={() => setFilter(f)}
      className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap', filter === f ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white')}
    >
      {label} <span className="opacity-70">{n}</span>
    </button>
  )
  const weekLabel = (n: number) => weeks.find(w => w.n === n)?.label ?? `Week ${n}`

  return (
    <div className="space-y-4">
      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search athletes"
            aria-label="Search athletes"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 pl-9 pr-9 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="inline-flex rounded-xl border border-line bg-panel2 p-1">
          {tab('all', 'All', athletes.length)}
          {tab('assigned', 'Assigned', assigned.size)}
          {tab('open', 'Not assigned', athletes.length - assigned.size)}
        </div>
      </div>

      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-zinc-500"><Users className="h-3.5 w-3.5" /> Assign a whole group:</span>
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => assignGroup(g)}
              disabled={busy === `g-${g.id}`}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-blue-500 hover:text-white disabled:opacity-50"
            >
              {g.name} ({g.athleteIds.length})
            </button>
          ))}
          {groupMsg && <span className="text-xs text-green-400">{groupMsg}</span>}
        </div>
      )}

      {/* Athletes, A to Z */}
      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">No athletes match.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(a => {
            const cur = assigned.get(a.id)
            return (
              <button
                key={a.id}
                onClick={() => open(a)}
                disabled={busy === a.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  cur ? 'border-blue-500/50 bg-blue-600/15' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500',
                  busy === a.id && 'opacity-50'
                )}
              >
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold', cur ? 'bg-blue-500 text-ink' : 'bg-panel2 text-zinc-300')}>
                  {cur ? <Check className="h-4 w-4" /> : initials(a.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm font-semibold', cur ? 'text-white' : 'text-zinc-200')}>{a.name}</span>
                  <span className="block truncate text-xs text-zinc-500">
                    {cur
                      ? `Starts ${formatShortDate(cur.startDate)}${cur.startWeek > 1 ? ` · at week ${cur.startWeek}` : ''}`
                      : a.sport || 'Tap to assign'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Assign / edit pop-up */}
      <Modal open={!!picked} onClose={() => setPicked(null)} title={picked ? (assigned.has(picked.id) ? `${picked.name}'s start` : `Assign to ${picked.name}`) : ''}>
        {picked && (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400"><CalendarDays className="h-3.5 w-3.5" /> Start date</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </label>
            {weeks.length > 1 && (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Start at</span>
                <select value={week} onChange={e => setWeek(Number(e.target.value))} className={inputCls}>
                  {weeks.map(w => <option key={w.n} value={w.n}>Week {w.n} · {w.label.replace(/\s*[—-]\s*Week\s*\d+\s*$/i, '')}</option>)}
                </select>
                <span className="block text-xs text-zinc-500">
                  {week > 1 ? `${picked.name.split(' ')[0]} begins with ${weekLabel(week)} on this date. Earlier weeks are skipped.` : 'Starts from the beginning of the program.'}
                </span>
              </label>
            )}
            <p className="text-xs text-zinc-500">Weeks run Monday to Sunday. More options (phase dates, how far ahead they can see) are on the athlete&apos;s page.</p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {assigned.has(picked.id) ? (
                <button onClick={remove} disabled={busy === picked.id} className="text-sm font-medium text-red-400 hover:text-red-300">Remove from program</button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>Cancel</Button>
                <Button size="sm" onClick={save} loading={busy === picked.id}>{assigned.has(picked.id) ? 'Save' : 'Assign'}</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
