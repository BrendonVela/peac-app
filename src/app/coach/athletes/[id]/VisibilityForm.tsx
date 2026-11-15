'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { updateAssignmentVisibility } from '@/app/actions/schedule'
import type { PhaseInfo } from '@/lib/schedule'

interface Props {
  assignmentId: string
  athleteId: string
  visibility: 'all' | 'ahead' | 'through'
  visibleWeeks: number
  visibleThrough: number | null
  totalWeeks: number
  phases: PhaseInfo[]
}

const selectCls = 'bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-full'

/** What the athlete can see of this program — e.g. only the next 4 weeks if they paid for one month */
export function VisibilityForm({ assignmentId, athleteId, visibility, visibleWeeks, visibleThrough, totalWeeks, phases }: Props) {
  const router = useRouter()
  const current = `${visibility}:${visibility === 'all' ? 0 : visibleWeeks}`
  const [value, setValue] = useState(current)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const options: { v: string; label: string }[] = [
    { v: 'all:0', label: 'Everything (all weeks)' },
    { v: 'ahead:1', label: 'Only the current week' },
    { v: 'ahead:2', label: 'Current week + 1 week ahead' },
    { v: 'ahead:4', label: 'Current week + 3 ahead (about a month)' },
    { v: 'ahead:8', label: 'Current week + 7 ahead (about 2 months)' },
    ...phases.filter(p => p.lastWeek < totalWeeks).map(p => ({ v: `through:${p.lastWeek}`, label: `Up to the end of ${p.label} (wk ${p.lastWeek})` })),
  ]
  // A custom choice saved earlier that isn't in the list
  if (!options.some(o => o.v === current)) {
    options.push({ v: current, label: visibility === 'ahead' ? `Current week + ${visibleWeeks - 1} ahead` : `Up to week ${visibleWeeks}` })
  }

  async function save(v: string) {
    setValue(v)
    const [vis, n] = v.split(':') as ['all' | 'ahead' | 'through', string]
    setSaving(true); setMsg('')
    const res = await updateAssignmentVisibility(assignmentId, athleteId, vis, Number(n) || 1)
    setSaving(false)
    if (res && 'error' in res && res.error) { setMsg(res.error); setValue(current); return }
    setMsg('Saved')
    router.refresh()
    setTimeout(() => setMsg(''), 2000)
  }

  const hidden = visibility !== 'all'
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-zinc-500">
          {hidden ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />} Athlete can see
        </span>
        <select value={value} onChange={e => save(e.target.value)} disabled={saving} className={selectCls}>
          {options.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        {msg && <span className={`text-xs ${msg === 'Saved' ? 'text-green-400' : 'text-red-400'}`}>{msg}</span>}
      </div>
      {hidden && visibleThrough !== null && (
        <p className="text-[11px] text-amber-300/80">
          Right now: weeks up to <b>week {Math.min(visibleThrough, totalWeeks)}</b> of {totalWeeks}.
          {visibility === 'ahead' ? ' More weeks unlock automatically each Monday.' : ''} Later weeks are hidden from the athlete.
        </p>
      )}
    </div>
  )
}
