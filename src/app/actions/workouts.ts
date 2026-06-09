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
    })

    if (error) return { error: error.message }
  }

  revalidatePath(`/athlete/workout/${workoutId}`)
}
