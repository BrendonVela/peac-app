'use server'

import { randomInt } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getStaffInfo } from '@/lib/acting'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const newCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

async function headCoach() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' as const }
  const info = await getStaffInfo(supabase, user.id)
  if (!info.ownId) return { error: 'Coach not found' as const }
  if (info.isAssistant) return { error: 'Only the head coach can manage staff.' as const }
  return { supabase, user, coachId: info.ownId }
}

export async function createStaffInvite(note: string) {
  const ctx = await headCoach()
  if ('error' in ctx) return { error: ctx.error }
  for (let i = 0; i < 5; i++) {
    const code = newCode()
    const { error } = await ctx.supabase.from('coach_invites').insert({
      code,
      note: note.trim() || null,
      created_by: ctx.user.id,
      head_coach_id: ctx.coachId,
    })
    if (!error) { revalidatePath('/coach/staff'); return { code } }
    if (!/duplicate|unique/i.test(error.message)) return { error: error.message }
  }
  return { error: 'Could not make an invite. Try again.' }
}

export async function deleteStaffInvite(code: string) {
  const ctx = await headCoach()
  if ('error' in ctx) return { error: ctx.error }
  const { error } = await ctx.supabase.from('coach_invites').delete().eq('code', code).eq('head_coach_id', ctx.coachId)
  if (error) return { error: error.message }
  revalidatePath('/coach/staff')
  return { ok: true }
}

export async function removeStaff(staffCoachId: string) {
  const ctx = await headCoach()
  if ('error' in ctx) return { error: ctx.error }
  const { error } = await ctx.supabase.rpc('remove_staff', { staff_coach_id: staffCoachId })
  if (error) return { error: error.message }
  revalidatePath('/coach/staff')
  return { ok: true }
}
