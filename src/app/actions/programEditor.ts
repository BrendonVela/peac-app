'use server'

import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const done = (programId: string) => {
  revalidatePath(`/coach/programs/${programId}`)
  return { ok: true as const }
}
const fail = (e: { message: string } | null) => (e ? { error: e.message } : null)

// ---------- Exercises in a day ----------
export async function addWorkoutExercise(
  programId: string,
  workoutId: string,
  exerciseId: string,
  f: { sets: string; reps: string; load: string; notes: string; section: string }
) {
  const supabase = createClient()
  const { data: last } = await supabase
    .from('workout_exercises')
    .select('order, section')
    .eq('workout_id', workoutId)
    .order('order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sets = parseInt(f.sets, 10)
  const { error } = await supabase.from('workout_exercises').insert({
    workout_id: workoutId,
    exercise_id: exerciseId,
    sets: isFinite(sets) && sets > 0 ? String(sets) : '3',
    reps: f.reps.trim() || null,
    load: f.load.trim() || null,
    notes: f.notes.trim() || null,
    section: f.section.trim() || null,
    order: (last?.order ?? 0) + 1,
  })
  return fail(error) ?? done(programId)
}

/** Create a new library exercise (no video yet) and return its id */
export async function createLibraryExercise(title: string, category: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const t = title.trim()
  if (!t) return { error: 'Type a name.' }
  const { data: existing } = await supabase.from('exercises').select('id').ilike('title', t).maybeSingle()
  if (existing) return { id: existing.id as string }
  const { data, error } = await supabase
    .from('exercises')
    .insert({ title: t, category: category || 'Strength', created_by: user?.id ?? null })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/coach/exercises')
  return { id: data.id as string }
}

export async function removeWorkoutExercise(programId: string, wxId: string) {
  const supabase = createClient()
  const { error } = await supabase.from('workout_exercises').delete().eq('id', wxId)
  return fail(error) ?? done(programId)
}

/** Move an exercise up (-1) or down (+1) within its day */
export async function moveWorkoutExercise(programId: string, wxId: string, dir: -1 | 1) {
  const supabase = createClient()
  const { data: me } = await supabase.from('workout_exercises').select('id, workout_id, order').eq('id', wxId).maybeSingle()
  if (!me) return { error: 'Not found' }
  const { data: list } = await supabase
    .from('workout_exercises')
    .select('id, order')
    .eq('workout_id', me.workout_id)
    .order('order')
  const arr = (list ?? []) as { id: string; order: number }[]
  const i = arr.findIndex(x => x.id === wxId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= arr.length) return done(programId)
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  // Rewrite 1..n so orders stay clean
  for (let k = 0; k < arr.length; k++) {
    await supabase.from('workout_exercises').update({ order: k + 1 }).eq('id', arr[k].id)
  }
  return done(programId)
}

// ---------- Days ----------
export async function addWorkoutDay(programId: string, blockId: string, title: string) {
  const supabase = createClient()
  const { data: last } = await supabase
    .from('workouts')
    .select('day_of_week')
    .eq('block_id', blockId)
    .order('day_of_week', { ascending: false })
    .limit(1)
    .maybeSingle()
  const n = (last?.day_of_week ?? 0) + 1
  const { error } = await supabase.from('workouts').insert({
    program_id: programId,
    block_id: blockId,
    title: title.trim() || `Day ${n}`,
    day_of_week: n,
  })
  return fail(error) ?? done(programId)
}

export async function renameWorkoutDay(programId: string, workoutId: string, title: string) {
  const supabase = createClient()
  if (!title.trim()) return { error: 'Type a name.' }
  const { error } = await supabase.from('workouts').update({ title: title.trim() }).eq('id', workoutId)
  return fail(error) ?? done(programId)
}

export async function deleteWorkoutDay(programId: string, workoutId: string) {
  const supabase = createClient()
  const { error } = await supabase.from('workouts').delete().eq('id', workoutId)
  return fail(error) ?? done(programId)
}

export async function saveWorkoutWarmup(programId: string, workoutId: string, title: string, itemsText: string) {
  const supabase = createClient()
  const items = itemsText.split('\n').map(l => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean)
  const { error } = await supabase
    .from('workouts')
    .update({ warmup: items.length ? { title: title.trim() || 'Warm-up', items } : null })
    .eq('id', workoutId)
  return fail(error) ?? done(programId)
}

// ---------- Weeks ----------
/** Add a week at the end: empty, or a full copy of another week */
export async function addWeek(programId: string, copyFromBlockId: string | null) {
  const supabase = createClient()
  const { data: blocks } = await supabase
    .from('training_blocks')
    .select('id, title, week_number, order')
    .eq('program_id', programId)
    .order('week_number', { ascending: false })
  const lastNum = blocks?.[0]?.week_number ?? 0
  const lastOrder = Math.max(0, ...(blocks ?? []).map((b: any) => b.order ?? 0))
  const src = copyFromBlockId ? (blocks ?? []).find((b: any) => b.id === copyFromBlockId) : null
  const newNum = lastNum + 1
  const baseTitle = src ? String(src.title).replace(/\s*—?\s*Week\s*\d+\s*$/i, '').trim() : ''
  const newBlockId = randomUUID()

  const { error: bErr } = await supabase.from('training_blocks').insert({
    id: newBlockId,
    program_id: programId,
    title: baseTitle ? `${baseTitle} — Week ${newNum}` : `Week ${newNum}`,
    week_number: newNum,
    order: lastOrder + 1,
  })
  if (bErr) return { error: bErr.message }

  if (src) {
    const { data: workouts } = await supabase.from('workouts').select('*').eq('block_id', src.id)
    const wMap = new Map<string, string>()
    const newWorkouts = (workouts ?? []).map((w: any) => {
      const id = randomUUID()
      wMap.set(w.id, id)
      const { id: _old, created_at: _c, ...rest } = w
      return { ...rest, id, block_id: newBlockId, program_id: programId }
    })
    if (newWorkouts.length) {
      const { error } = await supabase.from('workouts').insert(newWorkouts)
      if (error) return { error: error.message }
      const { data: wxs } = await supabase.from('workout_exercises').select('*').in('workout_id', Array.from(wMap.keys()))
      const newWx = (wxs ?? []).map((x: any) => {
        const { id: _old, created_at: _c, ...rest } = x
        return { ...rest, workout_id: wMap.get(x.workout_id) }
      })
      if (newWx.length) {
        const { error: e2 } = await supabase.from('workout_exercises').insert(newWx)
        if (e2) return { error: e2.message }
      }
    }
  }
  return done(programId)
}

export async function renameWeek(programId: string, blockId: string, title: string) {
  const supabase = createClient()
  if (!title.trim()) return { error: 'Type a name.' }
  const { error } = await supabase.from('training_blocks').update({ title: title.trim() }).eq('id', blockId)
  return fail(error) ?? done(programId)
}

/** Delete a week and close the gap so later weeks move up */
export async function deleteWeek(programId: string, blockId: string) {
  const supabase = createClient()
  const { data: me } = await supabase.from('training_blocks').select('week_number').eq('id', blockId).maybeSingle()
  const { error } = await supabase.from('training_blocks').delete().eq('id', blockId)
  if (error) return { error: error.message }
  if (me) {
    const { data: later } = await supabase
      .from('training_blocks')
      .select('id, week_number, order, title')
      .eq('program_id', programId)
      .gt('week_number', me.week_number)
      .order('week_number')
    for (const b of (later ?? []) as any[]) {
      await supabase
        .from('training_blocks')
        .update({
          week_number: b.week_number - 1,
          order: (b.order ?? b.week_number) - 1,
          title: String(b.title).replace(/^Week\s*\d+$/i, `Week ${b.week_number - 1}`),
        })
        .eq('id', b.id)
    }
  }
  return done(programId)
}
