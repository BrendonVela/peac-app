'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** Coach sets which exercises can be done instead of this one (both directions) */
export async function setExerciseAlternatives(exerciseId: string, alternativeIds: string[]) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const ids = Array.from(new Set(alternativeIds.filter(id => id && id !== exerciseId)))
  const { data: current } = await supabase
    .from('exercise_alternatives')
    .select('alternative_id')
    .eq('exercise_id', exerciseId)
  const before = new Set((current ?? []).map((r: any) => r.alternative_id as string))
  const removed = Array.from(before).filter(id => !ids.includes(id))

  // Remove both directions for anything unticked
  if (removed.length) {
    await supabase.from('exercise_alternatives').delete().eq('exercise_id', exerciseId).in('alternative_id', removed)
    await supabase.from('exercise_alternatives').delete().eq('alternative_id', exerciseId).in('exercise_id', removed)
  }
  // Add both directions (A can swap to B, and B to A)
  if (ids.length) {
    const rows = ids.flatMap(id => [
      { exercise_id: exerciseId, alternative_id: id, created_by: user.id },
      { exercise_id: id, alternative_id: exerciseId, created_by: user.id },
    ])
    const { error } = await supabase.from('exercise_alternatives').upsert(rows, { onConflict: 'exercise_id,alternative_id', ignoreDuplicates: true })
    if (error) return { error: error.message }
  }
  revalidatePath('/coach/exercises')
  return { ok: true }
}

/** Athlete (or coach) picks a swap for one exercise in a workout. null = back to the original */
export async function setWorkoutSwap(athleteId: string, workoutId: string, workoutExerciseId: string, swappedExerciseId: string | null) {
  const supabase = createClient()
  const { data: existing } = await supabase
    .from('workout_results')
    .select('id')
    .eq('athlete_id', athleteId)
    .eq('workout_exercise_id', workoutExerciseId)
    .maybeSingle()

  const { error } = existing
    ? await supabase.from('workout_results').update({ swapped_exercise_id: swappedExerciseId }).eq('id', existing.id)
    : await supabase.from('workout_results').insert({
        athlete_id: athleteId,
        workout_id: workoutId,
        workout_exercise_id: workoutExerciseId,
        completed: false,
        swapped_exercise_id: swappedExerciseId,
      })
  if (error) return { error: error.message }
  return { ok: true }
}
