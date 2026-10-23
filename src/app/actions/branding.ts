'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cleanColor } from '@/lib/brand'

/** Head coach saves team name, color and logo (logo is uploaded from the browser first) */
export async function saveBranding(data: { name: string; color: string | null; logoPath: string | null; removeLogo?: boolean }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (data.logoPath && !data.logoPath.startsWith(`${user.id}/`)) return { error: 'Invalid logo upload' }

  const { data: me } = await supabase.from('coaches').select('head_coach_id, brand_logo_path').eq('user_id', user.id).maybeSingle()
  if (!me) return { error: 'Coach not found' }
  if (me.head_coach_id) return { error: 'Only the head coach can change the team branding.' }

  const patch: Record<string, unknown> = {
    brand_name: data.name.trim().slice(0, 40) || null,
    brand_color: cleanColor(data.color),
  }
  if (data.logoPath) patch.brand_logo_path = data.logoPath
  if (data.removeLogo) patch.brand_logo_path = null
  const { error } = await supabase.from('coaches').update(patch).eq('user_id', user.id)
  if (error) return { error: error.message }

  // Tidy up the old logo file
  if ((data.logoPath || data.removeLogo) && me.brand_logo_path && me.brand_logo_path !== data.logoPath) {
    await supabase.storage.from('brand-logos').remove([me.brand_logo_path])
  }
  revalidatePath('/', 'layout')
  return { ok: true }
}
