'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function revalidateSchedulePages(athleteId?: string) {
  revalidatePath('/athlete/dashboard')
  revalidatePath('/athlete/calendar')
  if (athleteId) revalidatePath(`/coach/athletes/${athleteId}`)
}

/** Move a workout to a specific date for one athlete. Pass null to go back to the suggested day. */
export async function rescheduleWorkout(athleteId: string, workoutId: string, date: string | null) {
  const supabase = createClient()

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Invalid date' }
    const { error } = await supabase
      .from('workout_schedule')
      .upsert(
        { athlete_id: athleteId, workout_id: workoutId, scheduled_date: date, updated_at: new Date().toISOString() },
        { onConflict: 'athlete_id,workout_id' }
      )
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('workout_schedule')
      .delete()
      .eq('athlete_id', athleteId)
      .eq('workout_id', workoutId)
    if (error) return { error: error.message }
  }

  revalidateSchedulePages(athleteId)
  return { ok: true }
}

/** Change when Week 1 starts for one athlete's program */
export async function updateAssignmentStartDate(assignmentId: string, athleteId: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Invalid date' }
  const supabase = createClient()
  const { error } = await supabase
    .from('program_assignments')
    .update({ start_date: date })
    .eq('id', assignmentId)
  if (error) return { error: error.message }
  revalidateSchedulePages(athleteId)
  return { ok: true }
}
