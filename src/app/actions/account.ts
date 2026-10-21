'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { VIEW_AS_COOKIE } from '@/lib/acting'

/** Permanently delete the signed-in user's own account */
export async function deleteMyAccount() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (cookies().get(VIEW_AS_COOKIE)) return { error: 'Exit "View as" first.' }

  const { error } = await supabase.rpc('delete_my_account')
  if (error) return { error: error.message }
  await supabase.auth.signOut()
  return { ok: true }
}

/** Update the signed-in user's display name */
export async function updateMyName(name: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const clean = name.trim()
  if (!clean) return { error: 'Name can’t be empty' }

  const role = user.user_metadata?.role
  const table = role === 'coach' ? 'coaches' : 'athletes'
  const { error } = await supabase.from(table).update({ name: clean }).eq('user_id', user.id)
  if (error) return { error: error.message }
  await supabase.auth.updateUser({ data: { name: clean } })
  return { ok: true }
}
