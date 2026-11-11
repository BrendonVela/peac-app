'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { ask, canListen, getVoiceSettings, onVoiceCommand, speak } from '@/lib/voice/core'
import { normalizeNumbers } from '@/lib/voice/parse'
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

  // ---------- Voice: reads each question and fills in your answers ----------
  const answersRef = useRef(answers)
  answersRef.current = answers
  const runId = useRef(0)
  const [activeQ, setActiveQ] = useState<number | null>(null)
  const [voiceOn, setVoiceOn] = useState(false)
  useEffect(() => { setVoiceOn(getVoiceSettings().enabled) }, [])

  function heard(q: FormRow['questions'][number], text: string): unknown {
    const t = text.trim()
    const num = normalizeNumbers(t).match(/-?\d+(\.\d+)?/)
    if (q.type === 'scale') { const v = num ? Math.round(Number(num[0])) : NaN; return v >= 1 && v <= 10 ? v : undefined }
    if (q.type === 'number') return num ? Number(num[0]) : undefined
    if (q.type === 'yesno') return /^(yes|yeah|yep|yup|sure|correct)/i.test(t) ? true : /^(no|nope|nah|not)/i.test(t) ? false : undefined
    if (q.type === 'choice') {
      const low = t.toLowerCase()
      return (q.options ?? []).find(o => low.includes(o.toLowerCase()) || o.toLowerCase().includes(low))
    }
    return t || undefined
  }

  async function runVoice() {
    const id = ++runId.current
    const alive = () => runId.current === id
    if (!getVoiceSettings().enabled) return
    if (!getVoiceSettings().autoListen || !canListen()) { await speak(`${form.title}. Fill in each question on the screen, then tap submit.`); return }
    await speak(`${form.title}. ${form.questions.length} questions.`)
    for (let i = 0; i < form.questions.length; i++) {
      if (!alive()) return
      const q = form.questions[i]
      setActiveQ(i)
      document.getElementById(`fq-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const how = q.type === 'scale' ? ' From 1 to 10.' : q.type === 'yesno' ? ' Yes or no.' : q.type === 'choice' ? ` Say ${(q.options ?? []).join(', or ')}.` : ''
      let prompt = `Question ${i + 1}. ${q.label}.${how}`
      for (let attempt = 0; attempt < 2; attempt++) {
        const ans = await ask(prompt)
        if (!alive()) return
        if (!ans) { setActiveQ(null); await speak('No problem. You can finish on the screen.'); return }
        if (/^(skip|pass)\b/i.test(ans.trim())) break
        const v = heard(q, ans)
        if (v !== undefined) { set(q.id, v); break }
        prompt = q.type === 'choice' ? `Sorry. Say one of: ${(q.options ?? []).join(', ')}.` : q.type === 'yesno' ? 'Sorry, yes or no?' : 'Sorry, say a number.'
      }
    }
    setActiveQ(null)
    if (!alive()) return
    const ans = await ask('That is everything. Should I submit it? Say yes.')
    if (/^(yes|yeah|yep|sure|ok|okay|submit|send)/i.test(ans.trim())) await submit()
    else if (ans) await speak('Okay. Check your answers and tap submit when ready.')
  }

  useEffect(() => {
    const go = new URLSearchParams(window.location.search).get('voice') === '1'
    if (go) { const t = setTimeout(runVoice, 400); return () => { clearTimeout(t); runId.current++ } }
    return () => { runId.current++ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => onVoiceCommand(async cmd => {
    if (cmd.type === 'form' || cmd.type === 'start' || cmd.type === 'repeat') { runVoice(); return true }
    if (cmd.type === 'yes') { await submit(); return true }
    return false
  }, 10)) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    runId.current++
    setBusy(true); setError('')
    const res = await submitFormResponse(form.id, answers)
    setBusy(false)
    if (res && 'error' in res && res.error) { setError(res.error); speak(`I couldn't submit: ${res.error}`); return }
    speak('Submitted. Thanks.')
    router.push('/athlete/forms')
    router.refresh()
  }

  const pill = (on: boolean) => cn('rounded-lg border px-3 py-2 text-sm font-medium', on ? 'border-blue-500 bg-blue-600 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-300')
  const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-5">
      {voiceOn && (
        <button type="button" onClick={() => runVoice()} className="w-full flex items-center justify-center gap-2 rounded-xl border border-blue-600/40 bg-blue-600/10 py-2.5 text-sm text-blue-100">
          <Mic className="w-4 h-4" /> Fill it out loud
        </button>
      )}
      {form.questions.map((q, i) => (
        <div key={q.id} id={`fq-${q.id}`} className={cn('rounded-xl border bg-zinc-900 p-4 space-y-3', activeQ === i ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-zinc-800')}>
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
