'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

interface WorkoutExerciseDraft {
  exercise_id: string
  sets: string
  reps: string
  load: string
  tempo: string
  rest: string
  notes: string
  order: number
}

interface WorkoutDraft {
  title: string
  day_of_week: number
  notes: string
  exercises: WorkoutExerciseDraft[]
}

interface BlockDraft {
  title: string
  week_number: number
  order: number
  workouts: WorkoutDraft[]
}

export interface ProgramPayload {
  title: string
  description: string
  blocks: BlockDraft[]
}

export async function createProgram(payload: ProgramPayload) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!coach) return { error: 'Coach profile not found' }

  const { data: program, error: programError } = await supabase
    .from('programs')
    .insert({ coach_id: coach.id, title: payload.title, description: payload.description || null })
    .select('id')
    .single()

  if (programError || !program) return { error: programError?.message ?? 'Failed to create program' }

  for (const block of payload.blocks) {
    const { data: dbBlock, error: blockError } = await supabase
      .from('training_blocks')
      .insert({
        program_id: program.id,
        title: block.title,
        week_number: block.week_number,
        order: block.order,
      })
      .select('id')
      .single()

    if (blockError || !dbBlock) continue

    for (const workout of block.workouts) {
      const { data: dbWorkout, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          program_id: program.id,
          block_id: dbBlock.id,
          title: workout.title,
          day_of_week: workout.day_of_week,
          notes: workout.notes || null,
        })
        .select('id')
        .single()

      if (workoutError || !dbWorkout) continue

      if (workout.exercises.length > 0) {
        await supabase.from('workout_exercises').insert(
          workout.exercises.map(ex => ({
            workout_id: dbWorkout.id,
            exercise_id: ex.exercise_id,
            sets: ex.sets ? parseInt(ex.sets) : null,
            reps: ex.reps || null,
            load: ex.load || null,
            tempo: ex.tempo || null,
            rest: ex.rest || null,
            notes: ex.notes || null,
            order: ex.order,
          }))
        )
      }
    }
  }

  revalidatePath('/coach/programs')
  redirect(`/coach/programs/${program.id}`)
}

export async function assignProgram(programId: string, athleteId: string) {
  const supabase = createClient()
  const { error } = await supabase.from('program_assignments').upsert({
    program_id: programId,
    athlete_id: athleteId,
  })
  if (error) return { error: error.message }
  revalidatePath(`/coach/programs/${programId}`)
}

export async function unassignProgram(programId: string, athleteId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('program_assignments')
    .delete()
    .eq('program_id', programId)
    .eq('athlete_id', athleteId)
  if (error) return { error: error.message }
  revalidatePath(`/coach/programs/${programId}`)
}

export async function deleteProgram(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('programs').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/coach/programs')
  redirect('/coach/programs')
}

export async function createAthlete(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!coach) return { error: 'Coach not found' }

  const { error } = await supabase.from('athletes').insert({
    coach_id: coach.id,
    name: formData.get('name') as string,
    sport: (formData.get('sport') as string) || null,
    position: (formData.get('position') as string) || null,
    graduation_year: formData.get('graduation_year')
      ? parseInt(formData.get('graduation_year') as string)
      : null,
  })

  if (error) return { error: error.message }
  revalidatePath('/coach/athletes')
}
export async function claimAthlete(athleteId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!coach) return { error: 'Coach not found' }

  const { error } = await supabase
    .from('athletes')
    .update({ coach_id: coach.id })
    .eq('id', athleteId)
    .is('coach_id', null)

  if (error) return { error: error.message }
  revalidatePath('/coach/athletes')
}