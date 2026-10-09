'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CalendarDays, ExternalLink } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { rescheduleWorkout } from '@/app/actions/schedule'
import {
  addDays, calendarDate, formatShortDate, formatMonthDay,
  STATUS_LABEL, STATUS_BADGE,
  type ScheduledWorkout, type WorkoutStatus,
} from '@/lib/schedule'

const CHIP: Record<WorkoutStatus, string> = {
  done: 'bg-green-500/15 text-green-300 border-green-500/30 hover:bg-green-500/25',
  in_progress: 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25',
  not_started: 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700',
  missed: 'bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25',
}

const DOT: Record<WorkoutStatus, string> = {
  done: 'bg-green-400',
  in_progress: 'bg-blue-400',
  not_started: 'bg-zinc-500',
  missed: 'bg-red-400',
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Props {
  items: ScheduledWorkout[]
  athleteId: string
  today: string
  /** "YYYY-MM" */
  month: string
  /** Base URL for month navigation, e.g. "/athlete/calendar" */
  basePath: string
  mode: 'athlete' | 'coach'
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

export function ScheduleCalendar({ items, athleteId, today, month, basePath, mode }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<ScheduledWorkout | null>(null)
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Build a Monday-first grid covering the whole month
  const firstOfMonth = `${month}-01`
  const firstDow = (new Date(`${firstOfMonth}T00:00:00Z`).getUTCDay() + 6) % 7 // Mon = 0
  const gridStart = addDays(firstOfMonth, -firstDow)
  const nextMonthFirst = `${shiftMonth(month, 1)}-01`
  const days: string[] = []
  for (let d = gridStart; d < nextMonthFirst || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d)

  const byDate = new Map<string, ScheduledWorkout[]>()
  items.forEach(item => {
    const d = calendarDate(item)
    const list = byDate.get(d) ?? []
    list.push(item)
    byDate.set(d, list)
  })

  const monthLabel = new Date(`${firstOfMonth}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC', month: 'long', year: 'numeric',
  })

  const monthItems = items
    .filter(i => calendarDate(i).startsWith(month))
    .sort((a, b) => calendarDate(a).localeCompare(calendarDate(b)))

  function open(item: ScheduledWorkout) {
    setSelected(item)
    setDate(item.plannedDate)
    setError('')
  }

  async function save(newDate: string | null) {
    if (!selected) return
    setSaving(true)
    setError('')
    const res = await rescheduleWorkout(athleteId, selected.workoutId, newDate)
    setSaving(false)
    if (res && 'error' in res && res.error) {
      setError(res.error)
      return
    }
    setSelected(null)
    router.refresh()
  }

  const sep = basePath.includes('?') ? '&' : '?'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`${basePath}${sep}month=${shiftMonth(month, -1)}`}
          scroll={false}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="text-center">
          <p className="text-base font-semibold text-white">{monthLabel}</p>
          {!today.startsWith(month) && (
            <Link href={`${basePath}${sep}month=${today.slice(0, 7)}`} scroll={false} className="text-xs text-blue-400 hover:text-blue-300">
              Back to today
            </Link>
          )}
        </div>
        <Link
          href={`${basePath}${sep}month=${shiftMonth(month, 1)}`}
          scroll={false}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </Link>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
        {(['done', 'in_progress', 'not_started', 'missed'] as WorkoutStatus[]).map(s => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', DOT[s])} />
            {s === 'not_started' ? 'Upcoming' : STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      {/* Month grid (tablet / desktop) */}
      <div className="hidden sm:block rounded-xl border border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-7 bg-zinc-900 border-b border-zinc-800">
          {WEEKDAYS.map(d => (
            <div key={d} className="px-2 py-2 text-[11px] font-medium text-zinc-500 uppercase text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map(d => {
            const inMonth = d.startsWith(month)
            const isToday = d === today
            const dayItems = byDate.get(d) ?? []
            return (
              <div
                key={d}
                className={cn(
                  'min-h-24 border-b border-r border-zinc-800 p-1.5 space-y-1',
                  !inMonth && 'bg-zinc-950/60',
                )}
              >
                <div className="flex justify-end">
                  <span
                    className={cn(
                      'text-xs w-6 h-6 flex items-center justify-center rounded-full',
                      isToday ? 'bg-blue-600 text-white font-semibold' : inMonth ? 'text-zinc-400' : 'text-zinc-700',
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                </div>
                {dayItems.map(item => (
                  <button
                    key={item.workoutId}
                    onClick={() => open(item)}
                    title={item.title}
                    className={cn(
                      'block w-full text-left text-[11px] leading-tight px-1.5 py-1 rounded border truncate transition-colors',
                      CHIP[item.status],
                    )}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Agenda list (phones) */}
      <div className="sm:hidden space-y-2">
        {monthItems.length === 0 && (
          <p className="text-sm text-zinc-500 text-center py-6">No workouts this month.</p>
        )}
        {monthItems.map(item => {
          const d = calendarDate(item)
          return (
            <button
              key={item.workoutId}
              onClick={() => open(item)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-3 rounded-lg border text-left',
                d === today ? 'border-blue-600/50 bg-blue-600/5' : 'border-zinc-800 bg-zinc-900',
              )}
            >
              <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', DOT[item.status])} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-500">{formatShortDate(d)}</p>
                <p className="text-sm text-white truncate">{item.title}</p>
              </div>
              <Badge variant={STATUS_BADGE[item.status]} className="shrink-0">{STATUS_LABEL[item.status]}</Badge>
            </button>
          )
        })}
      </div>

      {/* Workout details / reschedule */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title}>
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <Badge variant={STATUS_BADGE[selected.status]}>{STATUS_LABEL[selected.status]}</Badge>
              <span>{selected.programTitle}</span>
              <span>·</span>
              <span>Week {selected.weekNumber} of {selected.totalWeeks}</span>
              <span>·</span>
              <span>{selected.doneCount}/{selected.exerciseCount} exercises</span>
            </div>

            <p className="text-xs text-zinc-500">
              Week {selected.weekNumber} runs {formatMonthDay(selected.weekStart)} – {formatMonthDay(selected.weekEnd)}.
              {selected.status === 'done' && selected.completedDate && (
                <> Completed {formatShortDate(selected.completedDate)}.</>
              )}
            </p>

            {selected.status !== 'done' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide">
                  <CalendarDays className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                  Planned day
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
                />
                {selected.isRescheduled && (
                  <button
                    onClick={() => save(null)}
                    disabled={saving}
                    className="text-xs text-zinc-400 hover:text-white underline"
                  >
                    Reset to suggested day
                  </button>
                )}
                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              {mode === 'athlete' && (
                <Link href={`/athlete/workout/${selected.workoutId}`} className="flex-1">
                  <Button variant="secondary" className="w-full">
                    <ExternalLink className="w-4 h-4" />
                    Open workout
                  </Button>
                </Link>
              )}
              {selected.status !== 'done' && (
                <Button
                  className="flex-1"
                  loading={saving}
                  disabled={!date || date === selected.plannedDate}
                  onClick={() => save(date)}
                >
                  Save day
                </Button>
              )}
              {mode === 'coach' && selected.status === 'done' && (
                <Button variant="secondary" className="flex-1" onClick={() => setSelected(null)}>Close</Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
