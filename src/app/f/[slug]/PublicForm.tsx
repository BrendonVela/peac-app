'use client'

import { useState } from 'react'
import { CheckCircle2, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatAnswer, type Question } from '@/lib/forms'
import { cn } from '@/lib/utils'

const inputCls = 'w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-3 text-base text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
const pill = (on: boolean) => cn('rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors', on ? 'border-blue-500 bg-blue-600 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-500')

export function PublicForm({ slug, title, questions, brand }: { slug: string; title: string; questions: Question[]; brand: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [trap, setTrap] = useState('') // hidden box only bots fill in
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const set = (id: string, v: unknown) => setAnswers(a => ({ ...a, [id]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Please enter your name.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Please enter a valid email.')
    const missing = questions.find(q => {
      const v = answers[q.id]
      return q.required && (v === undefined || v === '' || (Array.isArray(v) && v.length === 0))
    })
    if (missing) {
      document.getElementById(`pq-${missing.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return setError(`Please answer: ${missing.label}`)
    }
    if (trap) { setDone(true); return }
    setBusy(true)
    const { error } = await createClient().rpc('submit_public_form', { p_slug: slug, p_name: name.trim(), p_email: email.trim(), p_answers: answers })
    setBusy(false)
    if (error) {
      if (/already received/i.test(error.message)) { setDone(true); return }
      return setError(error.message.replace(/^.*?:\s*/, '') || 'Something went wrong. Try again.')
    }
    setDone(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (done) {
    return (
      <div className="space-y-6">
        <style>{`@media print { body { background:#fff !important; color:#000 } .no-print { display:none !important } .print-sheet { color:#000 } .print-sheet * { color:#000 !important; border-color:#ccc !important; background:transparent !important } }`}</style>
        <div className="no-print rounded-3xl border border-line bg-panel p-6 text-center space-y-3">
          <span className="peac-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-volt">
            <CheckCircle2 className="h-9 w-9 text-ink" />
          </span>
          <h2 className="font-display text-4xl font-extrabold uppercase">Thanks, {name.split(' ')[0]}!</h2>
          <p className="text-zinc-300">Your answers were sent to {brand}. A coach will be in touch.</p>
          <button onClick={() => window.print()} className="mx-auto flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-white">
            <Download className="h-4 w-4" /> Save a copy (PDF)
          </button>
        </div>
        <div className="print-sheet rounded-2xl border border-line bg-panel p-5 space-y-3">
          <p className="text-lg font-bold">{title}</p>
          <p className="text-sm text-zinc-400">{name} · {email}</p>
          <ol className="space-y-2">
            {questions.map((q, i) => (
              <li key={q.id} className="border-b border-line pb-2 text-sm">
                <p className="font-semibold">{i + 1}. {q.label}</p>
                <p className="text-zinc-300">{formatAnswer(q, answers[q.id])}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="rounded-2xl border border-line bg-panel p-4 space-y-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-white">Your name <span className="text-red-400">*</span></span>
          <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" className={inputCls} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-white">Email address <span className="text-red-400">*</span></span>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" className={inputCls} />
        </label>
        <input value={trap} onChange={e => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" />
      </div>

      {questions.map((q, i) => {
        const v = answers[q.id]
        const picked = Array.isArray(v) ? (v as string[]) : []
        return (
          <fieldset key={q.id} id={`pq-${q.id}`} className="rounded-2xl border border-line bg-panel p-4 space-y-3">
            <legend className="sr-only">{q.label}</legend>
            <p className="text-sm font-semibold text-white">{i + 1}. {q.label}{q.required && <span className="text-red-400"> *</span>}</p>
            {q.type === 'scale' && (
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 10 }, (_, k) => k + 1).map(n => (
                  <button type="button" key={n} onClick={() => set(q.id, n)} aria-pressed={v === n} className={cn('h-11 rounded-lg border text-sm font-bold', v === n ? 'border-blue-500 bg-blue-600 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-300')}>{n}</button>
                ))}
              </div>
            )}
            {q.type === 'yesno' && (
              <div className="flex gap-2">
                <button type="button" onClick={() => set(q.id, true)} aria-pressed={v === true} className={pill(v === true)}>Yes</button>
                <button type="button" onClick={() => set(q.id, false)} aria-pressed={v === false} className={pill(v === false)}>No</button>
              </div>
            )}
            {q.type === 'choice' && (
              <div className="flex flex-wrap gap-2">
                {(q.options ?? []).map(o => <button type="button" key={o} onClick={() => set(q.id, o)} aria-pressed={v === o} className={pill(v === o)}>{o}</button>)}
              </div>
            )}
            {q.type === 'multi' && (
              <div className="flex flex-wrap gap-2">
                {(q.options ?? []).map(o => {
                  const on = picked.includes(o)
                  return <button type="button" key={o} onClick={() => set(q.id, on ? picked.filter(x => x !== o) : [...picked, o])} aria-pressed={on} className={pill(on)}>{on ? '✓ ' : ''}{o}</button>
                })}
                <p className="basis-full text-xs text-zinc-500">Pick all that apply.</p>
              </div>
            )}
            {q.type === 'number' && (
              <input value={String(v ?? '')} onChange={e => set(q.id, e.target.value === '' ? '' : Number(e.target.value.replace(/[^\d.]/g, '')))} inputMode="decimal" className={inputCls} />
            )}
            {q.type === 'text' && (
              <textarea value={String(v ?? '')} onChange={e => set(q.id, e.target.value.slice(0, 2000))} rows={2} className={cn(inputCls, 'resize-none')} />
            )}
          </fieldset>
        )
      })}

      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={busy} className="flex h-14 w-full items-center justify-center rounded-2xl bg-blue-500 font-display text-xl font-extrabold uppercase tracking-wider text-ink disabled:opacity-60">
        {busy ? 'Sending…' : 'Submit'}
      </button>
      <p className="text-center text-xs text-zinc-500">Your answers go only to {brand}.</p>
    </form>
  )
}
