'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Moon, Zap, Brain, Activity, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { submitCheckIn } from '@/app/actions/checkins'
import { cn } from '@/lib/utils'

const fields = [
  { key: 'sleep_quality', label: 'Sleep Quality', icon: Moon, lowLabel: 'Poor', highLabel: 'Great', color: 'blue' },
  { key: 'energy', label: 'Energy Level', icon: Zap, lowLabel: 'Drained', highLabel: 'Energized', color: 'yellow' },
  { key: 'stress', label: 'Stress Level', icon: Brain, lowLabel: 'Relaxed', highLabel: 'Very Stressed', color: 'red', invert: true },
  { key: 'soreness', label: 'Muscle Soreness', icon: Activity, lowLabel: 'No Soreness', highLabel: 'Very Sore', color: 'orange', invert: true },
  { key: 'motivation', label: 'Motivation', icon: TrendingUp, lowLabel: 'Low', highLabel: 'High', color: 'green' },
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

export default function CheckInPage() {
  const router = useRouter()
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
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
      router.push('/athlete/dashboard')
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Heart className="w-6 h-6 text-red-400" />
        <div>
          <h1 className="text-2xl font-bold">Daily Check-In</h1>
          <p className="text-sm text-zinc-400">How are you feeling today?</p>
        </div>
      </div>

      {/* Score preview */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Readiness Score</p>
          <p className="text-4xl font-bold text-white mt-1">{score}<span className="text-lg text-zinc-500">/10</span></p>
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

      <form onSubmit={handleSubmit} className="space-y-5">
        {fields.map(({ key, label, icon: Icon, lowLabel, highLabel, color }) => (
          <div key={key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className={cn('w-4 h-4', colorMap[color])} />
                <span className="text-sm font-medium text-white">{label}</span>
              </div>
              <span className={cn('text-2xl font-bold', colorMap[color])}>{values[key]}</span>
            </div>
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
          Submit Check-In
        </Button>
      </form>
    </div>
  )
}
