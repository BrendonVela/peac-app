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

/** Where an athlete starts in a program (which week, on what date) and optional start dates for later phases */
export async function updateAssignmentPhases(
  assignmentId: string,
  athleteId: string,
  startWeek: number,
  startDate: string,
  phaseStarts: Record<string, string>
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { error: 'Pick a start date' }
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(phaseStarts ?? {})) {
    if (Number(k) > startWeek && /^\d{4}-\d{2}-\d{2}$/.test(v)) clean[String(Number(k))] = v
  }
  const supabase = createClient()
  const { error } = await supabase
    .from('program_assignments')
    .update({ start_date: startDate, start_week: Math.max(1, Math.round(startWeek) || 1), phase_starts: clean })
    .eq('id', assignmentId)
  if (error) {
    if (/start_week|phase_starts/.test(error.message)) return { error: 'Run the phase_dates SQL in Supabase first (see setup steps).' }
    return { error: error.message }
  }
  revalidateSchedulePages(athleteId)
  return { ok: true }
}
