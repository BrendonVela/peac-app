'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { updateWorkoutExercise } from '@/app/actions/programTools'

interface Props {
  programId: string
  wx: { id: string; sets: any; reps: string | null; load: string | null; notes: string | null; max_lift?: string | null }
  title: string
}

export function EditExerciseButton({ programId, wx, title }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setSaving(true); setError('')
    const res = await updateWorkoutExercise(wx.id, programId, {
      sets: String(f.get('sets') ?? ''),
      reps: String(f.get('reps') ?? ''),
      load: String(f.get('load') ?? ''),
      notes: String(f.get('notes') ?? ''),
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
          {wx.max_lift && (
            <p className="text-xs text-amber-300/80">
              Saving makes this weight exact — it will no longer scale from each athlete&apos;s max.
            </p>
          )}
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
