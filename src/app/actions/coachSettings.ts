'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveReadinessSettings(on: boolean, low: number, cut: number) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(low >= 1 && low <= 10)) return { error: 'Pick a readiness level from 1 to 10.' }
  if (!(cut >= 0 && cut <= 50)) return { error: 'Lower weights by 0–50%.' }
  const { error } = await supabase
    .from('coaches')
    .update({ readiness_on: on, readiness_low: low, readiness_cut: Math.round(cut) })
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/coach/settings')
  return { ok: true }
}
