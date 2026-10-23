'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { submitFormResponse } from '@/app/actions/forms'
import type { FormRow } from '@/lib/forms'
import { cn } from '@/lib/utils'

export function FillForm({ form, initial }: { form: FormRow; initial: Record<string, unknown> }) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, unknown>>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (id: string, v: unknown) => setAnswers(a => ({ ...a, [id]: v }))

  async function submit() {
    setBusy(true); setError('')
    const res = await submitFormResponse(form.id, answers)
    setBusy(false)
    if (res && 'error' in res && res.error) { setError(res.error); return }
    router.push('/athlete/forms')
    router.refresh()
  }

  const pill = (on: boolean) => cn('rounded-lg border px-3 py-2 text-sm font-medium', on ? 'border-blue-500 bg-blue-600 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-300')
  const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-5">
      {form.questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <p className="text-sm font-medium text-white">{i + 1}. {q.label}{q.required && <span className="text-red-400"> *</span>}</p>
          {q.type === 'scale' && (
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }, (_, k) => k + 1).map(n => (
                <button key={n} onClick={() => set(q.id, n)} className={cn('h-10 rounded-md text-sm font-semibold border', answers[q.id] === n ? 'bg-blue-600 border-blue-600 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-300')}>{n}</button>
              ))}
            </div>
          )}
          {q.type === 'yesno' && (
            <div className="flex gap-2">
              <button onClick={() => set(q.id, true)} className={pill(answers[q.id] === true)}>Yes</button>
              <button onClick={() => set(q.id, false)} className={pill(answers[q.id] === false)}>No</button>
            </div>
          )}
          {q.type === 'choice' && (
            <div className="flex flex-wrap gap-2">
              {(q.options ?? []).map(o => <button key={o} onClick={() => set(q.id, o)} className={pill(answers[q.id] === o)}>{o}</button>)}
            </div>
          )}
          {q.type === 'number' && (
            <input value={String(answers[q.id] ?? '')} onChange={e => set(q.id, e.target.value === '' ? '' : Number(e.target.value.replace(/[^\d.]/g, '')))} inputMode="decimal" className={inputCls} />
          )}
          {q.type === 'text' && (
            <textarea value={String(answers[q.id] ?? '')} onChange={e => set(q.id, e.target.value)} rows={2} className={cn(inputCls, 'resize-none')} />
          )}
        </div>
      ))}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button onClick={submit} loading={busy} className="w-full" size="lg">Submit</Button>
    </div>
  )
}
