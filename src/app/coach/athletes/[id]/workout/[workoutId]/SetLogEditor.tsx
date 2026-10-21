'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ArrowUp, ArrowDown, Pencil, MessageSquare, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { coachSaveResult, coachClearResult } from '@/app/actions/admin'
import type { SetTarget } from '@/lib/setTargets'

interface Log { weight: number | null; reps: number | null; done: boolean }

function firstNumber(text: string | null | undefined): number | null {
  if (!text) return null
  const m = String(text).match(/\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

interface Props {
  athleteId: string
  workoutId: string
  workoutExerciseId: string
  targets: SetTarget[]
  initialLogs: Log[]
  initialNotes: string
  initialCompleted: boolean
  hasResult: boolean
}

export function SetLogEditor({
  athleteId, workoutId, workoutExerciseId, targets, initialLogs, initialNotes, initialCompleted, hasResult,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState(() =>
    targets.map((_, k) => ({
      weight: initialLogs[k]?.weight != null ? String(initialLogs[k].weight) : '',
      reps: initialLogs[k]?.reps != null ? String(initialLogs[k].reps) : '',
      done: !!initialLogs[k]?.done,
    }))
  )
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setRows(targets.map((_, k) => ({
      weight: initialLogs[k]?.weight != null ? String(initialLogs[k].weight) : '',
      reps: initialLogs[k]?.reps != null ? String(initialLogs[k].reps) : '',
      done: !!initialLogs[k]?.done,
    })))
    setNotes(initialNotes)
    setError('')
    setEditing(false)
  }

  async function save() {
    setSaving(true); setError('')
    const set_logs = rows.map(r => ({
      weight: r.weight !== '' ? parseFloat(r.weight) : null,
      reps: r.reps !== '' ? parseInt(r.reps) : null,
      done: r.done,
    }))
    const res = await coachSaveResult(athleteId, workoutId, workoutExerciseId, {
      set_logs,
      notes,
      completed: set_logs.length > 0 && set_logs.every(l => l.done),
    })
    setSaving(false)
    if (res && 'error' in res && res.error) { setError(res.error); return }
    setEditing(false)
    router.refresh()
  }

  async function clear() {
    if (!confirm('Clear everything logged for this exercise?')) return
    setSaving(true)
    const res = await coachClearResult(athleteId, workoutId, workoutExerciseId)
    setSaving(false)
    if (res && 'error' in res && res.error) { setError(res.error); return }
    setRows(targets.map(() => ({ weight: '', reps: '', done: false })))
    setNotes('')
    setEditing(false)
    router.refresh()
  }

  const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-[56px_1fr_1fr_40px] gap-2 px-3 py-1.5 bg-zinc-800/40 text-[10px] uppercase font-medium text-zinc-500">
          <span>Set</span><span>Target</span><span>Actual</span><span className="text-center">Done</span>
        </div>
        <div className="divide-y divide-zinc-800">
          {targets.map((t, k) => {
            const r = rows[k]
            const tW = firstNumber(t.weight), tR = firstNumber(t.reps)
            const aW = r.weight !== '' ? Number(r.weight) : null
            const aR = r.reps !== '' ? Number(r.reps) : null
            const hasActual = aW != null || aR != null
            const dW = tW != null && aW != null ? aW - tW : 0
            const dR = tR != null && aR != null ? aR - tR : 0
            const above = dW > 0 || (dW === 0 && dR > 0)
            const below = dW < 0 || (dW === 0 && dR < 0)
            return (
              <div key={k} className={cn('grid grid-cols-[56px_1fr_1fr_40px] gap-2 items-center px-3 py-2 text-sm', r.done && 'bg-green-500/[0.04]')}>
                <span className="text-xs text-zinc-400">{t.label}</span>
                <span className="text-zinc-400 truncate">{[t.weight, t.reps].filter(Boolean).join(' × ') || '—'}</span>
                {editing ? (
                  <span className="grid grid-cols-2 gap-1.5">
                    <input value={r.weight} onChange={e => setRows(p => p.map((x, i) => i === k ? { ...x, weight: e.target.value } : x))}
                      type="number" inputMode="decimal" placeholder="lb" className={inputCls} />
                    <input value={r.reps} onChange={e => setRows(p => p.map((x, i) => i === k ? { ...x, reps: e.target.value } : x))}
                      type="number" inputMode="numeric" placeholder="reps" className={inputCls} />
                  </span>
                ) : (
                  <span className={cn('flex items-center gap-1', above ? 'text-green-400' : below ? 'text-amber-400' : 'text-white')}>
                    {hasActual
                      ? <>{aW != null ? `${aW} lb` : '—'} × {aR != null ? aR : '—'}</>
                      : <span className="text-zinc-600">{r.done ? 'As prescribed' : '—'}</span>}
                    {hasActual && above && <ArrowUp className="w-3 h-3" />}
                    {hasActual && below && <ArrowDown className="w-3 h-3" />}
                  </span>
                )}
                <span className="flex justify-center">
                  {editing ? (
                    <button
                      onClick={() => setRows(p => p.map((x, i) => i === k ? { ...x, done: !x.done } : x))}
                      className={cn('w-7 h-7 rounded-md border flex items-center justify-center',
                        r.done ? 'bg-green-600 border-green-600 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500')}
                      aria-label="Toggle done"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  ) : r.done && <Check className="w-4 h-4 text-green-400" />}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {editing ? (
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Athlete note (optional)" className={inputCls} />
      ) : notes && (
        <p className="flex items-start gap-1.5 text-sm text-zinc-300">
          <MessageSquare className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
          <span><span className="text-zinc-500">Athlete note:</span> {notes}</span>
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button size="sm" loading={saving} onClick={save}>Save changes</Button>
            <Button size="sm" variant="secondary" onClick={reset}>Cancel</Button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white">
            <Pencil className="w-3.5 h-3.5" /> Edit sets
          </button>
        )}
        {hasResult && (
          <button onClick={clear} disabled={saving} className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" /> Clear exercise
          </button>
        )}
      </div>
    </div>
  )
}
