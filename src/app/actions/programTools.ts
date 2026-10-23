'use server'

import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { todayISO } from '@/lib/schedule'
import { scaleLoad, type LiftKey } from '@/lib/maxes'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Copy a whole program for one athlete and assign the copy to them */
export async function duplicateProgramForAthlete(programId: string, athleteId: string) {
  const supabase = createClient()

  const [{ data: program }, { data: athlete }] = await Promise.all([
    supabase.from('programs').select('*').eq('id', programId).single(),
    supabase.from('athletes').select('id, name').eq('id', athleteId).single(),
  ])
  if (!program) return { error: 'Program not found' }
  if (!athlete) return { error: 'Athlete not found' }

  const [{ data: blocks }, { data: workouts }] = await Promise.all([
    supabase.from('training_blocks').select('*').eq('program_id', programId),
    supabase.from('workouts').select('*').eq('program_id', programId),
  ])
  const workoutIds = (workouts ?? []).map((w: any) => w.id)

  let wxRows: any[] = []
  for (const ids of chunk(workoutIds, 80)) {
    const { data, error } = await supabase.from('workout_exercises').select('*').in('workout_id', ids)
    if (error) return { error: error.message }
    wxRows = wxRows.concat(data ?? [])
  }

  // New ids so everything links up in a few bulk inserts
  const newProgramId = randomUUID()
  const blockMap = new Map<string, string>()
  const workoutMap = new Map<string, string>()
  ;(blocks ?? []).forEach((b: any) => blockMap.set(b.id, randomUUID()))
  ;(workouts ?? []).forEach((w: any) => workoutMap.set(w.id, randomUUID()))

  const { error: pErr } = await supabase.from('programs').insert({
    id: newProgramId,
    coach_id: program.coach_id,
    title: `${program.title} — ${athlete.name}`,
    description: program.description,
  })
  if (pErr) return { error: pErr.message }

  const strip = ({ id, created_at, ...rest }: any) => rest

  const newBlocks = (blocks ?? []).map((b: any) => ({
    ...strip(b), id: blockMap.get(b.id), program_id: newProgramId,
  }))
  for (const part of chunk(newBlocks, 200)) {
    const { error } = await supabase.from('training_blocks').insert(part)
    if (error) return { error: error.message }
  }

  const newWorkouts = (workouts ?? []).map((w: any) => ({
    ...strip(w),
    id: workoutMap.get(w.id),
    program_id: newProgramId,
    block_id: w.block_id ? blockMap.get(w.block_id) ?? null : null,
  }))
  for (const part of chunk(newWorkouts, 200)) {
    const { error } = await supabase.from('workouts').insert(part)
    if (error) return { error: error.message }
  }

  const newWx = wxRows.map((x: any) => ({ ...strip(x), workout_id: workoutMap.get(x.workout_id) }))
  for (const part of chunk(newWx, 400)) {
    const { error } = await supabase.from('workout_exercises').insert(part)
    if (error) return { error: error.message }
  }

  // Move the athlete's assignment to the copy (keep their start date)
  const { data: oldAssign } = await supabase
    .from('program_assignments')
    .select('id, start_date')
    .eq('program_id', programId)
    .eq('athlete_id', athleteId)
    .maybeSingle()

  if (oldAssign) await supabase.from('program_assignments').delete().eq('id', oldAssign.id)

  const { error: aErr } = await supabase.from('program_assignments').insert({
    program_id: newProgramId,
    athlete_id: athleteId,
    start_date: oldAssign?.start_date ?? todayISO(),
  })
  if (aErr) return { error: aErr.message }

  revalidatePath('/coach/programs')
  revalidatePath(`/coach/athletes/${athleteId}`)
  return { id: newProgramId }
}

/** Scale weights in a program, e.g. all Squat loads to 95% */
export async function scaleProgramWeights(programId: string, lift: LiftKey | 'all', percent: number) {
  if (!isFinite(percent) || percent <= 0 || percent > 300) return { error: 'Enter a percent between 1 and 300' }
  const ratio = percent / 100
  const supabase = createClient()

  const { data: workouts } = await supabase.from('workouts').select('id').eq('program_id', programId)
  const workoutIds = (workouts ?? []).map((w: any) => w.id)

  let rows: any[] = []
  for (const ids of chunk(workoutIds, 80)) {
    const { data, error } = await supabase.from('workout_exercises').select('*').in('workout_id', ids)
    if (error) return { error: error.message }
    rows = rows.concat(data ?? [])
  }

  const changed = rows
    .filter(r => (lift === 'all' ? true : r.max_lift === lift))
    .map(r => {
      const load = scaleLoad(r.load, ratio)
      const setTargets = Array.isArray(r.set_targets)
        ? r.set_targets.map((t: any) => ({ ...t, weight: scaleLoad(t?.weight ?? null, ratio) }))
        : r.set_targets
      const isChanged = load !== r.load || JSON.stringify(setTargets) !== JSON.stringify(r.set_targets)
      return isChanged ? { ...r, load, set_targets: setTargets } : null
    })
    .filter((r): r is any => r !== null)

  for (const part of chunk(changed, 400)) {
    const { error } = await supabase.from('workout_exercises').upsert(part)
    if (error) return { error: error.message }
  }

  revalidatePath(`/coach/programs/${programId}`)
  return { ok: true, count: changed.length }
}

/** Edit one exercise in a program */
export async function updateWorkoutExercise(
  id: string,
  programId: string,
  data: { sets: string; reps: string; load: string; notes: string; lift?: string; refMax?: string; applyAll?: boolean }
) {
  const supabase = createClient()
  const { data: cur } = await supabase
    .from('workout_exercises')
    .select('exercise_id, sets, reps, load, max_lift, ref_max')
    .eq('id', id)
    .maybeSingle()
  if (!cur) return { error: 'Exercise not found' }

  const sets = parseInt(data.sets, 10)
  const newSets = isFinite(sets) && sets > 0 ? sets : null
  const newReps = data.reps.trim() || null
  const newLoad = data.load.trim() || null
  const prescriptionChanged =
    String(newSets ?? '') !== String(cur.sets ?? '') || newReps !== (cur.reps ?? null) || newLoad !== (cur.load ?? null)

  const lift = data.lift && ['squat', 'trap_bar_dl', 'db_bench', 'pendlay_row'].includes(data.lift) ? data.lift : null
  const refNum = Number(String(data.refMax ?? '').replace(/[^\d.]/g, ''))
  const refMax = lift && refNum > 0 ? refNum : null

  const patch: Record<string, unknown> = { notes: data.notes.trim() || null, max_lift: lift, ref_max: refMax }
  if (prescriptionChanged) {
    patch.sets = newSets
    patch.reps = newReps
    patch.load = newLoad
    // Hand-entered numbers replace any per-set targets
    patch.set_targets = null
  }
  const { error } = await supabase.from('workout_exercises').update(patch).eq('id', id)
  if (error) return { error: error.message }

  // Same lift link on this exercise everywhere in the program
  if (data.applyAll) {
    const { data: ws } = await supabase.from('workouts').select('id').eq('program_id', programId)
    const ids = (ws ?? []).map((w: any) => w.id)
    for (const part of chunk(ids, 100)) {
      const { error: e2 } = await supabase
        .from('workout_exercises')
        .update({ max_lift: lift, ref_max: refMax })
        .in('workout_id', part)
        .eq('exercise_id', cur.exercise_id)
      if (e2) return { error: e2.message }
    }
  }
  revalidatePath(`/coach/programs/${programId}`)
  return { ok: true }
}
