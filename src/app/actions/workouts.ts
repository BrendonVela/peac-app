'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function logWorkoutResult(
  athleteId: string,
  workoutId: string,
  workoutExerciseId: string,
  data: {
    weight_used?: number
    reps_completed?: number
    completed: boolean
    notes?: string
    set_logs?: { weight: number | null; reps: number | null; done: boolean }[]
  }
) {
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('workout_results')
    .select('id')
    .eq('athlete_id', athleteId)
    .eq('workout_exercise_id', workoutExerciseId)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('workout_results')
      .update({
        weight_used: data.weight_used ?? null,
        reps_completed: data.reps_completed ?? null,
        completed: data.completed,
        notes: data.notes ?? null,
        set_logs: data.set_logs ?? null,
        logged_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('workout_results').insert({
      athlete_id: athleteId,
      workout_id: workoutId,
      workout_exercise_id: workoutExerciseId,
      weight_used: data.weight_used ?? null,
      reps_completed: data.reps_completed ?? null,
      completed: data.completed,
      notes: data.notes ?? null,
      set_logs: data.set_logs ?? null,
    })

    if (error) return { error: error.message }
  }

  revalidatePath(`/athlete/workout/${workoutId}`)
  revalidatePath('/athlete/dashboard')
  revalidatePath('/athlete/calendar')
}


/** Save which warm-up items are checked off */
export async function saveWarmupProgress(athleteId: string, workoutId: string, done: number[]) {
  const supabase = createClient()
  const { error } = await supabase
    .from('warmup_logs')
    .upsert(
      { athlete_id: athleteId, workout_id: workoutId, done, updated_at: new Date().toISOString() },
      { onConflict: 'athlete_id,workout_id' }
    )
  if (error) return { error: error.message }
  return { ok: true }
}

/** Athlete (or their coach) rates how hard a workout was: session RPE x minutes = training load */
export async function saveWorkoutSession(
  athleteId: string,
  workoutId: string,
  data: { rpe: number; minutes: number | null; notes?: string }
) {
  const supabase = createClient()
  const rpe = Math.round(data.rpe)
  if (!(rpe >= 1 && rpe <= 10)) return { error: 'Pick a number from 1 to 10.' }
  const minutes = data.minutes != null && data.minutes > 0 ? Math.min(600, Math.round(data.minutes)) : null
  const { error } = await supabase.from('workout_sessions').upsert(
    {
      athlete_id: athleteId,
      workout_id: workoutId,
      rpe,
      minutes,
      notes: data.notes?.trim() || null,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'athlete_id,workout_id' }
  )
  if (error) return { error: error.message }
  revalidatePath(`/coach/athletes/${athleteId}`)
  revalidatePath('/coach/reports')
  return { ok: true }
}
