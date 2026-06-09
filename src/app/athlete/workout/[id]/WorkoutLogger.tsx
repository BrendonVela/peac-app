'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react'
import { logWorkoutResult } from '@/app/actions/workouts'
import { cn } from '@/lib/utils'

interface Props {
  workoutExerciseId: string
  workoutId: string
  athleteId: string
  initialWeight?: number
  initialReps?: number
  initialCompleted: boolean
  initialNotes: string
  videoUrl?: string | null
}

export function WorkoutLogger({
  workoutExerciseId, workoutId, athleteId,
  initialWeight, initialReps, initialCompleted, initialNotes, videoUrl,
}: Props) {
  const [weight, setWeight] = useState(initialWeight?.toString() ?? '')
  const [reps, setReps] = useState(initialReps?.toString() ?? '')
  const [notes, setNotes] = useState(initialNotes)
  const [completed, setCompleted] = useState(initialCompleted)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave(isCompleted: boolean) {
    setSaving(true)
    setCompleted(isCompleted)
    await logWorkoutResult(athleteId, workoutId, workoutExerciseId, {
      weight_used: weight ? parseFloat(weight) : undefined,
      reps_completed: reps ? parseInt(reps) : undefined,
      completed: isCompleted,
      notes: notes || undefined,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-3">
      {/* Log inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-zinc-500 uppercase font-medium block mb-1">Weight Used</label>
          <input
            value={weight}
            onChange={e => setWeight(e.target.value)}
            type="number"
            step="0.5"
            placeholder="lbs"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 uppercase font-medium block mb-1">Reps Done</label>
          <input
            value={reps}
            onChange={e => setReps(e.target.value)}
            type="number"
            placeholder="reps"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <input
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={() => handleSave(!completed)}
          disabled={saving}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            completed
              ? 'bg-green-600/20 border border-green-600/40 text-green-400 hover:bg-green-600/30'
              : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600'
          )}
        >
          {completed
            ? <CheckCircle2 className="w-4 h-4" />
            : <Circle className="w-4 h-4" />
          }
          {completed ? 'Completed' : 'Mark Complete'}
        </button>

        <button
          onClick={() => handleSave(completed)}
          disabled={saving}
          className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>

        {videoUrl && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 ml-auto"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Demo
          </a>
        )}
      </div>
    </div>
  )
}
