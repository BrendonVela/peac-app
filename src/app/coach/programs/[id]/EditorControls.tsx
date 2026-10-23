'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, ArrowDown, Trash2, Plus, Copy, Pencil, Flame, Search } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import {
  addWorkoutExercise, createLibraryExercise, removeWorkoutExercise, moveWorkoutExercise,
  addWorkoutDay, renameWorkoutDay, deleteWorkoutDay, saveWorkoutWarmup,
  addWeek, renameWeek, deleteWeek,
} from '@/app/actions/programEditor'
import { cn } from '@/lib/utils'

const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
const iconBtn = 'p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 disabled:opacity-30'

function useRun() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function run(fn: () => Promise<any>) {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    if (res && 'error' in res && res.error) { alert(res.error); return false }
    router.refresh()
    return true
  }
  return { busy, run }
}

/** Stops clicks inside a <summary> from opening/closing the week */
const stop = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation() }

// ---------- Exercise row ----------
export function ExerciseControls({ programId, wxId, first, last }: { programId: string; wxId: string; first: boolean; last: boolean }) {
  const { busy, run } = useRun()
  return (
    <span className="flex items-center">
      <button className={iconBtn} disabled={busy || first} onClick={() => run(() => moveWorkoutExercise(programId, wxId, -1))} title="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
      <button className={iconBtn} disabled={busy || last} onClick={() => run(() => moveWorkoutExercise(programId, wxId, 1))} title="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
      <button
        className={cn(iconBtn, 'hover:text-red-400')}
        disabled={busy}
        onClick={() => { if (confirm('Remove this exercise from this day?')) run(() => removeWorkoutExercise(programId, wxId)) }}
        title="Remove"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </span>
  )
}

// ---------- Add exercise ----------
export function AddExerciseButton({ programId, workoutId, section }: { programId: string; workoutId: string; section: string | null }) {
  const { busy, run } = useRun()
  const [open, setOpen] = useState(false)
  const [lib, setLib] = useState<{ id: string; title: string; category: string }[]>([])
  const [q, setQ] = useState('')
  const [pick, setPick] = useState<{ id: string; title: string } | null>(null)
  const [f, setF] = useState({ sets: '3', reps: '', load: '', notes: '', section: section ?? '' })

  function openModal() {
    setOpen(true); setPick(null); setQ('')
    setF({ sets: '3', reps: '', load: '', notes: '', section: section ?? '' })
    if (lib.length === 0) {
      createClient().from('exercises').select('id, title, category').order('title').then(({ data }) => setLib((data ?? []) as any))
    }
  }

  const matches = lib.filter(e => e.title.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40)
  const exact = lib.some(e => e.title.toLowerCase() === q.trim().toLowerCase())

  async function createNew() {
    const res = await createLibraryExercise(q, 'Strength')
    if ('error' in res && res.error) { alert(res.error); return }
    if ('id' in res && res.id) setPick({ id: res.id, title: q.trim() })
  }

  async function save() {
    if (!pick) return
    if (await run(() => addWorkoutExercise(programId, workoutId, pick.id, f))) setOpen(false)
  }

  return (
    <>
      <button onClick={openModal} className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-blue-400 hover:text-blue-300">
        <Plus className="w-3.5 h-3.5" /> Add exercise
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add exercise">
        {!pick ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search your exercise library…" className={cn(inputCls, 'pl-9')} />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-800 divide-y divide-zinc-800">
              {matches.map(e => (
                <button key={e.id} onClick={() => setPick({ id: e.id, title: e.title })} className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-zinc-800/50">
                  <span className="text-sm text-white truncate">{e.title}</span>
                  <span className="text-[11px] text-zinc-500">{e.category}</span>
                </button>
              ))}
              {lib.length === 0 && <p className="px-3 py-4 text-sm text-zinc-500">Loading…</p>}
            </div>
            {q.trim() && !exact && (
              <button onClick={createNew} className="text-sm text-blue-400 hover:text-blue-300">
                + Create &ldquo;{q.trim()}&rdquo; as a new exercise
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-white font-medium">{pick.title} <button onClick={() => setPick(null)} className="ml-2 text-xs text-zinc-400 hover:text-white">change</button></p>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs text-zinc-400 space-y-1">Sets<input value={f.sets} onChange={e => setF({ ...f, sets: e.target.value })} inputMode="numeric" className={inputCls} /></label>
              <label className="text-xs text-zinc-400 space-y-1">Reps<input value={f.reps} onChange={e => setF({ ...f, reps: e.target.value })} placeholder="8 reps" className={inputCls} /></label>
              <label className="text-xs text-zinc-400 space-y-1">Weight<input value={f.load} onChange={e => setF({ ...f, load: e.target.value })} placeholder="135 lb or 75%" className={inputCls} /></label>
            </div>
            <label className="block text-xs text-zinc-400 space-y-1">Section (optional)<input value={f.section} onChange={e => setF({ ...f, section: e.target.value })} placeholder="e.g. PRIMARY LIFT, SUPERSET A" className={inputCls} /></label>
            <label className="block text-xs text-zinc-400 space-y-1">Coaching note (optional)<input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className={inputCls} /></label>
            <p className="text-[11px] text-zinc-500">Tip: give exercises the same section name with &ldquo;SUPERSET&rdquo; in it and athletes will be told to rotate through them.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={save} loading={busy}>Add to day</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

// ---------- Day ----------
export function DayControls({ programId, workoutId, title, warmup }: {
  programId: string; workoutId: string; title: string; warmup: { title?: string; items?: string[] } | null
}) {
  const { busy, run } = useRun()
  const [mode, setMode] = useState<'rename' | 'warmup' | null>(null)
  const [name, setName] = useState(title)
  const [wTitle, setWTitle] = useState(warmup?.title ?? 'Warm-up')
  const [wItems, setWItems] = useState((warmup?.items ?? []).join('\n'))

  return (
    <span className="flex items-center ml-auto">
      <button className={iconBtn} onClick={() => setMode('warmup')} title="Edit warm-up"><Flame className="w-3.5 h-3.5" /></button>
      <button className={iconBtn} onClick={() => setMode('rename')} title="Rename day"><Pencil className="w-3.5 h-3.5" /></button>
      <button
        className={cn(iconBtn, 'hover:text-red-400')}
        disabled={busy}
        onClick={() => { if (confirm(`Delete "${title}" and its exercises? Logged sets for this day are deleted too.`)) run(() => deleteWorkoutDay(programId, workoutId)) }}
        title="Delete day"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <Modal open={mode === 'rename'} onClose={() => setMode(null)} title="Rename day">
        <div className="space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          <div className="flex justify-end"><Button size="sm" loading={busy} onClick={async () => { if (await run(() => renameWorkoutDay(programId, workoutId, name))) setMode(null) }}>Save</Button></div>
        </div>
      </Modal>
      <Modal open={mode === 'warmup'} onClose={() => setMode(null)} title="Warm-up">
        <div className="space-y-3">
          <input value={wTitle} onChange={e => setWTitle(e.target.value)} className={inputCls} />
          <textarea value={wItems} onChange={e => setWItems(e.target.value)} rows={8} placeholder={'One item per line, e.g.\nBike 3 min\n90/90 hip switch x10'} className={cn(inputCls, 'resize-none')} />
          <p className="text-[11px] text-zinc-500">Leave it empty to remove the warm-up.</p>
          <div className="flex justify-end"><Button size="sm" loading={busy} onClick={async () => { if (await run(() => saveWorkoutWarmup(programId, workoutId, wTitle, wItems))) setMode(null) }}>Save warm-up</Button></div>
        </div>
      </Modal>
    </span>
  )
}

export function AddDayButton({ programId, blockId, nextNumber }: { programId: string; blockId: string; nextNumber: number }) {
  const { busy, run } = useRun()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  return (
    <>
      <button onClick={() => { setName(`Day ${nextNumber}`); setOpen(true) }} className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 py-3 text-sm text-zinc-400 hover:text-white hover:border-zinc-500">
        <Plus className="w-4 h-4" /> Add a day to this week
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add day">
        <div className="space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. MON — Lower Body" className={inputCls} />
          <div className="flex justify-end"><Button size="sm" loading={busy} onClick={async () => { if (await run(() => addWorkoutDay(programId, blockId, name))) setOpen(false) }}>Add day</Button></div>
        </div>
      </Modal>
    </>
  )
}

// ---------- Week ----------
export function WeekControls({ programId, blockId, title }: { programId: string; blockId: string; title: string }) {
  const { busy, run } = useRun()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(title)
  return (
    <span className="flex items-center" onClick={stop}>
      <button className={iconBtn} disabled={busy} onClick={e => { stop(e); if (confirm('Copy this whole week to a new week at the end?')) run(() => addWeek(programId, blockId)) }} title="Copy week"><Copy className="w-3.5 h-3.5" /></button>
      <button className={iconBtn} onClick={e => { stop(e); setRenaming(true) }} title="Rename week"><Pencil className="w-3.5 h-3.5" /></button>
      <button
        className={cn(iconBtn, 'hover:text-red-400')}
        disabled={busy}
        onClick={e => { stop(e); if (confirm('Delete this whole week? Later weeks move up one.')) run(() => deleteWeek(programId, blockId)) }}
        title="Delete week"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      <Modal open={renaming} onClose={() => setRenaming(false)} title="Rename week">
        <div className="space-y-3" onClick={e => e.stopPropagation()}>
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          <div className="flex justify-end"><Button size="sm" loading={busy} onClick={async () => { if (await run(() => renameWeek(programId, blockId, name))) setRenaming(false) }}>Save</Button></div>
        </div>
      </Modal>
    </span>
  )
}

export function AddWeekButton({ programId }: { programId: string }) {
  const { busy, run } = useRun()
  return (
    <button
      disabled={busy}
      onClick={() => run(() => addWeek(programId, null))}
      className="w-full flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-zinc-700 py-4 text-sm text-zinc-400 hover:text-white hover:border-zinc-500"
    >
      <Plus className="w-4 h-4" /> {busy ? 'Adding…' : 'Add an empty week'}
    </button>
  )
}
