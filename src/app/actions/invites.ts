'use server'

import { randomInt } from 'crypto'
import { coachMatch } from '@/lib/acting'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

// No 0/O/1/I so codes are easy to read out loud
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function newCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)]
  return code
}

/** Get (or create) the coach's invite code */
export async function getOrCreateJoinCode() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: coach } = await supabase.from('coaches').select('id, join_code').match(await coachMatch(supabase, user.id)).single()
  if (!coach) return { error: 'Coach not found' }
  if (coach.join_code) return { code: coach.join_code as string }
  return regenerateJoinCode()
}

/** Make a new invite code (the old link stops working) */
export async function regenerateJoinCode() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode()
    const { error } = await supabase.from('coaches').update({ join_code: code }).match(await coachMatch(supabase, user.id))
    if (!error) {
      revalidatePath('/coach/athletes')
      return { code }
    }
    if (!/duplicate|unique/i.test(error.message)) return { error: error.message }
  }
  return { error: 'Could not create a code. Try again.' }
}

function cleanCode(raw: string): { code: string } | { error: string } {
  const code = raw.trim().toUpperCase()
  if (!/^[A-Z0-9-]{4,20}$/.test(code)) return { error: 'Use 4–20 letters, numbers or dashes (no spaces).' }
  return { code }
}

/** Coach picks their own athlete sign-up code */
export async function setMyJoinCode(raw: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const c = cleanCode(raw)
  if ('error' in c) return c
  const { error } = await supabase.from('coaches').update({ join_code: c.code }).match(await coachMatch(supabase, user.id))
  if (error) return { error: /duplicate|unique/i.test(error.message) ? 'Another coach already uses that code. Try a different one.' : error.message }
  revalidatePath('/coach/athletes')
  revalidatePath('/coach/admin')
  return { code: c.code }
}

/** Admin sets (or randomizes, when raw is null) any coach's athlete sign-up code */
export async function adminSetJoinCode(coachId: string, raw: string | null) {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'Only the admin can change other coaches\' codes.' }
  const admin = createAdminClient()
  if (!admin) return { error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' }

  for (let attempt = 0; attempt < 5; attempt++) {
    let code: string
    if (raw === null) code = newCode()
    else {
      const c = cleanCode(raw)
      if ('error' in c) return c
      code = c.code
    }
    const { error } = await admin.from('coaches').update({ join_code: code }).eq('id', coachId)
    if (!error) {
      revalidatePath('/coach/admin')
      revalidatePath('/coach/athletes')
      return { code }
    }
    if (!/duplicate|unique/i.test(error.message)) return { error: error.message }
    if (raw !== null) return { error: 'Another coach already uses that code. Try a different one.' }
  }
  return { error: 'Could not create a code. Try again.' }
}

/** A signed-in athlete joins the coach behind this code */
export async function joinCoach(code: string) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('join_coach', { code })
  if (error) return { error: error.message }
  if (!data) return { error: 'This invite link is no longer valid, or you already have a coach.' }
  revalidatePath('/athlete/dashboard')
  return { ok: true }
}
