'use server'

import { randomInt } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function code(len = 8) {
  let c = ''
  for (let i = 0; i < len; i++) c += ALPHABET[randomInt(ALPHABET.length)]
  return c
}

function fail(error: { message: string } | null) {
  return error ? { error: error.message } : null
}

function refresh() {
  revalidatePath('/coach/admin')
  revalidatePath('/coach/athletes')
  revalidatePath('/coach/dashboard')
}

// ---------- Coach invites ----------
export async function createCoachInvite(note: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  for (let i = 0; i < 5; i++) {
    const c = code()
    const { error } = await supabase.from('coach_invites').insert({ code: c, note: note.trim() || null, created_by: user.id })
    if (!error) { refresh(); return { code: c } }
    if (!/duplicate|unique/i.test(error.message)) return { error: error.message }
  }
  return { error: 'Could not create invite. Try again.' }
}

export async function deleteCoachInvite(inviteCode: string) {
  const supabase = createClient()
  const { error } = await supabase.from('coach_invites').delete().eq('code', inviteCode)
  refresh()
  return fail(error) ?? { ok: true }
}

// ---------- Shared coach sign-up code ----------
export async function setCoachSignupCode(value: string | null) {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'Only the admin can change the coach code.' }
  let v: string | null = null
  if (value !== null) {
    v = value.trim().toUpperCase()
    if (!/^[A-Z0-9-]{4,30}$/.test(v)) return { error: 'Use 4–30 letters, numbers or dashes (no spaces).' }
  }
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'coach_signup_code', value: v, updated_at: new Date().toISOString() })
  refresh()
  return fail(error) ?? { ok: true, code: v }
}

export async function generateCoachSignupCode() {
  return setCoachSignupCode('PEAC-' + code(6))
}

// ---------- Set someone's password (admin only) ----------
export async function adminSetPassword(userId: string, password: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'Only the admin can set passwords.' }
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' }
  const admin = createAdminClient()
  if (!admin) return { error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' }
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  return fail(error) ?? { ok: true }
}

// ---------- People ----------
export async function setAdmin(coachId: string, value: boolean) {
  const supabase = createClient()
  const { error } = await supabase.rpc('admin_set_admin', { coach_id: coachId, value })
  refresh()
  return fail(error) ?? { ok: true }
}

export async function moveAthlete(athleteId: string, coachId: string | null) {
  const supabase = createClient()
  const { error } = await supabase.rpc('admin_move_athlete', { athlete_id: athleteId, coach_id: coachId })
  refresh()
  return fail(error) ?? { ok: true }
}

export async function deleteAthlete(athleteId: string) {
  const supabase = createClient()
  const { error } = await supabase.rpc('admin_delete_athlete', { athlete_id: athleteId })
  refresh()
  return fail(error) ?? { ok: true }
}

export async function deleteCoach(coachId: string, transferTo: string | null) {
  const supabase = createClient()
  const { error } = await supabase.rpc('admin_delete_coach', { coach_id: coachId, transfer_to: transferTo })
  refresh()
  revalidatePath('/coach/programs')
  return fail(error) ?? { ok: true }
}

/** Clears logged sets, warm-ups and moved workouts (optionally check-ins and tests) */
export async function resetAthleteData(athleteId: string, includeCheckins: boolean, includeTests: boolean) {
  const supabase = createClient()
  const { error } = await supabase.rpc('reset_athlete_data', {
    athlete_id: athleteId,
    include_checkins: includeCheckins,
    include_tests: includeTests,
  })
  refresh()
  revalidatePath(`/coach/athletes/${athleteId}`)
  return fail(error) ?? { ok: true }
}

// ---------- Coaches fixing logged sets ----------
export async function coachSaveResult(
  athleteId: string,
  workoutId: string,
  workoutExerciseId: string,
  data: { set_logs: { weight: number | null; reps: number | null; done: boolean }[]; notes: string; completed: boolean }
) {
  const supabase = createClient()
  const best = data.set_logs
    .filter(l => l.weight != null || l.reps != null)
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0]
  const row = {
    athlete_id: athleteId,
    workout_id: workoutId,
    workout_exercise_id: workoutExerciseId,
    set_logs: data.set_logs,
    weight_used: best?.weight ?? null,
    reps_completed: best?.reps ?? null,
    completed: data.completed,
    notes: data.notes.trim() || null,
  }
  const { data: existing } = await supabase
    .from('workout_results')
    .select('id')
    .eq('athlete_id', athleteId)
    .eq('workout_exercise_id', workoutExerciseId)
    .maybeSingle()

  const { error } = existing
    ? await supabase.from('workout_results').update(row).eq('id', existing.id)
    : await supabase.from('workout_results').insert(row)
  revalidatePath(`/coach/athletes/${athleteId}/workout/${workoutId}`)
  revalidatePath(`/coach/athletes/${athleteId}`)
  return fail(error) ?? { ok: true }
}

export async function coachClearResult(athleteId: string, workoutId: string, workoutExerciseId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('workout_results')
    .delete()
    .eq('athlete_id', athleteId)
    .eq('workout_exercise_id', workoutExerciseId)
  revalidatePath(`/coach/athletes/${athleteId}/workout/${workoutId}`)
  revalidatePath(`/coach/athletes/${athleteId}`)
  return fail(error) ?? { ok: true }
}

export async function coachClearWorkout(athleteId: string, workoutId: string) {
  const supabase = createClient()
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from('workout_results').delete().eq('athlete_id', athleteId).eq('workout_id', workoutId),
    supabase.from('warmup_logs').delete().eq('athlete_id', athleteId).eq('workout_id', workoutId),
  ])
  revalidatePath(`/coach/athletes/${athleteId}/workout/${workoutId}`)
  revalidatePath(`/coach/athletes/${athleteId}`)
  return fail(e1) ?? fail(e2) ?? { ok: true }
}
