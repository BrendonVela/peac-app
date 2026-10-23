'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { updateWorkoutExercise } from '@/app/actions/programTools'
import { LIFTS } from '@/lib/maxes'

interface Props {
  programId: string
  wx: { id: string; sets: any; reps: string | null; load: string | null; notes: string | null; max_lift?: string | null; ref_max?: number | string | null }
  title: string
  /** The max each lift's weights were written for elsewhere in this program */
  refs?: Record<string, number>
}

export function EditExerciseButton({ programId, wx, title, refs = {} }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lift, setLift] = useState<string>(wx.max_lift ?? '')
  const [refMax, setRefMax] = useState<string>(wx.ref_max ? String(Number(wx.ref_max)) : '')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setSaving(true); setError('')
    const res = await updateWorkoutExercise(wx.id, programId, {
      sets: String(f.get('sets') ?? ''),
      reps: String(f.get('reps') ?? ''),
      load: String(f.get('load') ?? ''),
      notes: String(f.get('notes') ?? ''),
      lift,
      refMax,
      applyAll: f.get('applyAll') === 'on',
    })
    setSaving(false)
    if (res && 'error' in res && res.error) { setError(res.error); return }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-zinc-500 hover:text-white p-1" title="Edit exercise">
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Edit — ${title}`}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Input label="Sets" name="sets" type="number" min={1} max={20} defaultValue={wx.sets ?? ''} />
            <Input label="Reps" name="reps" defaultValue={wx.reps ?? ''} placeholder="8 reps" />
            <Input label="Weight" name="load" defaultValue={wx.load ?? ''} placeholder="210lb" />
          </div>
          <Textarea label="Coaching note" name="notes" rows={2} defaultValue={wx.notes ?? ''} />
          <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Scale with each athlete&apos;s max</p>
            <select
              value={lift}
              onChange={e => { setLift(e.target.value); if (!refMax && refs[e.target.value]) setRefMax(String(refs[e.target.value])) }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Don&apos;t scale — use the weight exactly</option>
              {LIFTS.map(l => <option key={l.key} value={l.key}>Link to {l.label}</option>)}
            </select>
            {lift && (
              <>
                <label className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                  Weights here were written for a max of
                  <input
                    value={refMax}
                    onChange={e => setRefMax(e.target.value.replace(/[^\d.]/g, ''))}
                    inputMode="numeric"
                    placeholder="e.g. 300"
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-sm text-white text-center"
                  />
                  lb
                </label>
                <p className="text-[11px] text-zinc-500">
                  Each athlete gets the weight × (their max ÷ this number). Or type the weight as a percent like <b>75%</b> and it becomes 75% of their max.
                </p>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input type="checkbox" name="applyAll" defaultChecked className="w-4 h-4 accent-blue-600" />
                  Link this exercise in every week of the program
                </label>
              </>
            )}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={saving}>Save</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
