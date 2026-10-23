'use client'

import { useState } from 'react'
import { Gauge, Check } from 'lucide-react'
import { saveWorkoutSession } from '@/app/actions/workouts'
import { saveOrQueue } from '@/lib/offlineQueue'
import { cn } from '@/lib/utils'

export interface SessionInfo { rpe: number; minutes: number | null; notes: string | null }

const LABELS: Record<number, string> = {
  1: 'Very easy', 2: 'Easy', 3: 'Moderate', 4: 'Somewhat hard', 5: 'Hard',
  6: 'Hard+', 7: 'Very hard', 8: 'Very hard+', 9: 'Near max', 10: 'Max effort',
}

export function SessionRpe({ athleteId, workoutId, initial }: { athleteId: string; workoutId: string; initial: SessionInfo | null }) {
  const [rpe, setRpe] = useState<number | null>(initial?.rpe ?? null)
  const [minutes, setMinutes] = useState(initial?.minutes ? String(initial.minutes) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(!!initial)
  const [error, setError] = useState('')

  async function save() {
    if (!rpe) return
    setSaving(true); setError('')
    const payload = { rpe, minutes: minutes ? Number(minutes) : null, notes }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await saveOrQueue('saveWorkoutSession', [athleteId, workoutId, payload], `${athleteId}:${workoutId}`)
      setSaving(false); setSaved(true); return
    }
    const res = await saveWorkoutSession(athleteId, workoutId, payload)
    setSaving(false)
    if (res && 'error' in res && res.error) { setError(res.error); return }
    setSaved(true)
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3 text-left">
      <p className="flex items-center gap-2 text-sm font-semibold text-white">
        <Gauge className="w-4 h-4 text-blue-400" /> How hard was this workout?
      </p>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => { setRpe(n); setSaved(false) }}
            className={cn(
              'h-10 rounded-md text-sm font-semibold border transition-colors',
              rpe === n
                ? n <= 4 ? 'bg-green-600 border-green-600 text-white' : n <= 7 ? 'bg-amber-500 border-amber-500 text-black' : 'bg-red-600 border-red-600 text-white'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-400 h-4">{rpe ? `${rpe} — ${LABELS[rpe]}` : '1 = very easy · 10 = all-out'}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Minutes
          <input
            value={minutes}
            onChange={e => { setMinutes(e.target.value.replace(/[^\d]/g, '')); setSaved(false) }}
            inputMode="numeric"
            placeholder="60"
            className="w-20 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <input
          value={notes}
          onChange={e => { setNotes(e.target.value); setSaved(false) }}
          placeholder="Anything to tell your coach? (optional)"
          className="flex-1 min-w-[10rem] bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={!rpe || saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white disabled:opacity-40"
        >
          {saved ? <><Check className="w-4 h-4" /> Saved</> : saving ? 'Saving…' : 'Save'}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  )
}
