'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { ask, canListen, getVoiceSettings, onVoiceCommand, speak } from '@/lib/voice/core'
import { answerNumber } from '@/lib/voice/parse'
import { Heart, Moon, Zap, Brain, Activity, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { submitCheckIn } from '@/app/actions/checkins'
import { cn } from '@/lib/utils'

const fields = [
  { key: 'sleep_quality', label: 'Sleep Quality', icon: Moon, lowLabel: 'Poor', highLabel: 'Great', color: 'blue', desc: 'How well did you sleep last night?' },
  { key: 'energy', label: 'Energy Level', icon: Zap, lowLabel: 'Drained', highLabel: 'Energized', color: 'yellow', desc: 'How much gas is in the tank right now?' },
  { key: 'stress', label: 'Stress Level', icon: Brain, lowLabel: 'Relaxed', highLabel: 'Very Stressed', color: 'red', invert: true, desc: 'School, work, life — how much is on your mind?' },
  { key: 'soreness', label: 'Muscle Soreness', icon: Activity, lowLabel: 'No Soreness', highLabel: 'Very Sore', color: 'orange', invert: true, desc: 'How sore or achy are your muscles?' },
  { key: 'motivation', label: 'Motivation', icon: TrendingUp, lowLabel: 'Low', highLabel: 'High', color: 'green', desc: 'How much do you want to train today?' },
] as const

const colorMap: Record<string, string> = {
  blue: 'text-blue-400',
  yellow: 'text-yellow-400',
  red: 'text-red-400',
  orange: 'text-orange-400',
  green: 'text-green-400',
}

function computeScore(values: Record<string, number>) {
  const { sleep_quality, energy, stress, soreness, motivation } = values
  return ((sleep_quality + energy + (11 - stress) + (11 - soreness) + motivation) / 5).toFixed(1)
}

export function CheckInForm({ onDone, submitLabel = 'Submit Check-In', showHeader = true, voice = false }: { onDone: () => void; submitLabel?: string; showHeader?: boolean; /** Start the spoken check-in right away */ voice?: boolean }) {
  const [values, setValues] = useState<Record<string, number>>({
    sleep_quality: 7,
    energy: 7,
    stress: 3,
    soreness: 3,
    motivation: 8,
  })
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const score = computeScore(values)
  const valuesRef = useRef(values)
  valuesRef.current = values
  const [activeQ, setActiveQ] = useState<number | null>(null)
  const [voiceOn, setVoiceOn] = useState(false) // read after load so server and phone match
  useEffect(() => { setVoiceOn(getVoiceSettings().enabled) }, [])
  const runId = useRef(0)

  // ---------- Spoken check-in: asks each question, listens for a number ----------
  async function runVoice() {
    const id = ++runId.current
    const alive = () => runId.current === id
    if (!getVoiceSettings().enabled) return
    const listening = getVoiceSettings().autoListen && canListen()
    if (!listening) {
      await speak("Quick check-in before we train. Slide each bar to how you feel, then tap the button at the bottom.")
      return
    }
    await speak("Quick check-in before we train. Answer each one with a number from 1 to 10.")
    for (let i = 0; i < fields.length; i++) {
      if (!alive()) return
      const f = fields[i]
      setActiveQ(i)
      document.getElementById(`ci-${f.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      let prompt = `${f.label}. ${f.desc} 1 is ${f.lowLabel.toLowerCase()}, 10 is ${f.highLabel.toLowerCase()}.`
      for (let attempt = 0; attempt < 2; attempt++) {
        const ans = await ask(prompt)
        if (!alive()) return
        if (!ans) { setActiveQ(null); await speak('No problem. Use the sliders, or tap the mic and say a number.'); return }
        if (/^(skip|pass|same|keep it)/i.test(ans.trim())) break
        const v = answerNumber(ans)
        if (v != null) { setValues(prev => ({ ...prev, [f.key]: v })); break }
        prompt = 'Sorry, just a number from 1 to 10.'
      }
    }
    setActiveQ(null)
    if (!alive()) return
    const final = computeScore(valuesRef.current)
    const ans = await ask(`Your readiness is ${final} out of 10. Ready to check in? Say yes.`)
    if (!alive()) return
    if (/^(yes|yeah|yep|sure|ok|okay|ready|let'?s go|do it|submit)/i.test(ans.trim())) await submitNow()
    else if (ans) await speak('Okay. Change anything you want, then tap the button.')
  }

  useEffect(() => {
    if (voice) { const t = setTimeout(runVoice, 400); return () => { clearTimeout(t); runId.current++ } }
    return () => { runId.current++ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mic commands while this screen is open
  useEffect(() => onVoiceCommand(async cmd => {
    if (cmd.type === 'checkin' || cmd.type === 'start' || cmd.type === 'repeat') { runVoice(); return true }
    if (cmd.type === 'yes') { await submitNow(); return true }
    if (cmd.type === 'number') {
      const i = activeQ ?? 0
      const f = fields[i]
      if (cmd.value >= 1 && cmd.value <= 10) { setValues(prev => ({ ...prev, [f.key]: cmd.value })); await speak(`${f.label}, ${cmd.value}.`); return true }
    }
    return false
  }, 10)) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await submitNow()
  }

  async function submitNow() {
    runId.current++
    setSubmitting(true)
    setError('')

    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => fd.set(k, String(v)))
    fd.set('notes', notes)

    const result = await submitCheckIn(fd)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      if (getVoiceSettings().enabled) speak(voice ? 'Checked in. Let\'s get to work.' : 'Checked in.')
      onDone()
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 w-full">
      {showHeader && <div className="flex items-center gap-3">
        <Heart className="w-6 h-6 text-red-400" />
        <div>
          <h1 className="text-2xl font-bold">Daily Check-In</h1>
          <p className="text-sm text-zinc-400">How are you feeling today?</p>
        </div>
      </div>}

      {/* Score preview */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Readiness Score</p>
          <p className="text-4xl font-bold text-white mt-1">{score}<span className="text-lg text-zinc-500">/10</span></p>
          <p className="text-[11px] text-zinc-500 mt-1">Your overall score from the answers below. Higher = more ready to train.</p>
        </div>
        <div className={cn(
          'w-20 h-20 rounded-full border-4 flex items-center justify-center text-2xl font-bold',
          parseFloat(score) >= 7 ? 'border-green-500 text-green-400' :
          parseFloat(score) >= 5 ? 'border-yellow-500 text-yellow-400' :
          'border-red-500 text-red-400'
        )}>
          {score}
        </div>
      </div>

      {voiceOn && (
        <button type="button" onClick={() => runVoice()} className="w-full flex items-center justify-center gap-2 rounded-xl border border-blue-600/40 bg-blue-600/10 py-2.5 text-sm text-blue-100">
          <Mic className="w-4 h-4" /> Do my check-in out loud
        </button>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {fields.map(({ key, label, icon: Icon, lowLabel, highLabel, color, desc }) => (
          <div key={key} id={`ci-${key}`} className={cn('bg-zinc-900 border rounded-xl p-4 space-y-3 transition-colors', activeQ !== null && fields[activeQ]?.key === key ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-zinc-800')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className={cn('w-4 h-4', colorMap[color])} />
                <span className="text-sm font-medium text-white">{label}</span>
              </div>
              <span className={cn('text-2xl font-bold', colorMap[color])}>{values[key]}</span>
            </div>
            <p className="-mt-2 text-xs text-zinc-400">{desc}</p>
            <input
              type="range"
              min={1}
              max={10}
              value={values[key]}
              onChange={e => setValues(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
              className="w-full h-2 appearance-none rounded-full bg-zinc-700 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-zinc-500">
              <span>{lowLabel}</span>
              <span>{highLabel}</span>
            </div>
          </div>
        ))}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
          <label className="text-sm font-medium text-white">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any additional notes for your coach..."
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button type="submit" loading={submitting} size="lg" className="w-full">
          {submitLabel}
        </Button>
      </form>
    </div>
  )
}
