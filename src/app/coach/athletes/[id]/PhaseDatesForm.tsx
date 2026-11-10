'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarRange, ChevronDown } from 'lucide-react'
import { updateAssignmentPhases } from '@/app/actions/schedule'
import { formatShortDate, weekStartFor, type PhaseInfo } from '@/lib/schedule'

interface Props {
  assignmentId: string
  athleteId: string
  startDate: string
  startWeek: number
  phaseStarts: Record<string, string>
  phases: PhaseInfo[]
}

const inputCls = 'bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]'

/** Where the athlete starts (phase + week + date) and optional dates for later phases */
export function PhaseDatesForm({ assignmentId, athleteId, startDate, startWeek, phaseStarts, phases }: Props) {
  const router = useRouter()
  const [week, setWeek] = useState(startWeek)
  const [date, setDate] = useState(startDate)
  const [later, setLater] = useState<Record<string, string>>(phaseStarts ?? {})
  const [open, setOpen] = useState(Object.keys(phaseStarts ?? {}).length > 0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const list = phases.length ? phases : [{ label: 'Week 1', firstWeek: 1, lastWeek: 1 }]
  const phaseIdx = Math.max(0, list.findIndex(p => week >= p.firstWeek && week <= p.lastWeek))
  const phase = list[phaseIdx]
  const laterPhases = list.slice(phaseIdx + 1)
  const showPhaseDates = laterPhases.length > 0 && list.length <= 15

  const dirty = week !== startWeek || date !== startDate || JSON.stringify(clean(later, week)) !== JSON.stringify(clean(phaseStarts ?? {}, startWeek))

  // When each later phase would start if left blank
  const autoDates = useMemo(() => {
    const m: Record<number, string> = {}
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return m
    for (const p of laterPhases) {
      const others = { ...clean(later, week) }
      delete others[String(p.firstWeek)]
      m[p.firstWeek] = weekStartFor(p.firstWeek, week, date, others)
    }
    return m
  }, [date, week, later, laterPhases])

  async function save() {
    setSaving(true); setMsg('')
    const res = await updateAssignmentPhases(assignmentId, athleteId, week, date, clean(later, week))
    setSaving(false)
    if (res && 'error' in res && res.error) { setMsg(res.error); return }
    setMsg('Saved')
    router.refresh()
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className="space-y-2 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">Starts at</span>
        {list.length > 1 && (
          <select value={phaseIdx} onChange={e => setWeek(list[Number(e.target.value)].firstWeek)} className={inputCls} aria-label="Phase">
            {list.map((p, i) => <option key={p.firstWeek} value={i}>{p.label}</option>)}
          </select>
        )}
        <select value={week} onChange={e => setWeek(Number(e.target.value))} className={inputCls} aria-label="Week">
          {Array.from({ length: phase.lastWeek - phase.firstWeek + 1 }, (_, k) => phase.firstWeek + k).map(w => (
            <option key={w} value={w}>
              {list.length > 1 ? `Week ${w - phase.firstWeek + 1} of phase` : `Week ${w}`}{list.length > 1 ? ` (wk ${w})` : ''}
            </option>
          ))}
        </select>
        <span className="text-xs text-zinc-500">on</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} aria-label="Start date" />
        {dirty && (
          <button onClick={save} disabled={saving} className="text-xs px-2.5 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        {msg && <span className={`text-xs ${msg === 'Saved' ? 'text-green-400' : 'text-red-400'}`}>{msg}</span>}
      </div>
      {week > 1 && <p className="text-[11px] text-zinc-500">Weeks before week {week} are skipped — they won&apos;t show or count as missed.</p>}

      {showPhaseDates && (
        <div>
          <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 text-[11px] text-blue-300 hover:text-blue-200">
            <CalendarRange className="w-3.5 h-3.5" /> Phase start dates
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="mt-2 space-y-1.5 rounded-lg border border-zinc-700/60 p-2">
              <p className="text-[11px] text-zinc-500">Leave blank to start right after the phase before. Set a date to start a phase on a specific week (e.g. after a break).</p>
              {laterPhases.map(p => {
                const key = String(p.firstWeek)
                return (
                  <div key={key} className="flex flex-wrap items-center gap-2">
                    <span className="w-28 truncate text-xs text-zinc-300" title={p.label}>{p.label}</span>
                    <span className="text-[10px] text-zinc-600 w-16">wk {p.firstWeek}{p.lastWeek > p.firstWeek ? `–${p.lastWeek}` : ''}</span>
                    <input
                      type="date"
                      value={later[key] ?? ''}
                      onChange={e => setLater(l => ({ ...l, [key]: e.target.value }))}
                      className={inputCls}
                    />
                    {later[key]
                      ? <button onClick={() => setLater(l => { const n = { ...l }; delete n[key]; return n })} className="text-[11px] text-zinc-400 underline">auto</button>
                      : autoDates[p.firstWeek] && <span className="text-[11px] text-zinc-500">auto: week of {formatShortDate(autoDates[p.firstWeek])}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function clean(m: Record<string, string>, startWeek: number): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of Object.keys(m).sort((a, b) => Number(a) - Number(b))) {
    if (Number(k) > startWeek && /^\d{4}-\d{2}-\d{2}$/.test(m[k])) out[k] = m[k]
  }
  return out
}
