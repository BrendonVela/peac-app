// "View as": lets an admin open the app as any coach or athlete.
// The choice is stored in a cookie and only honored for admins.

import { cache } from 'react'
import { cookies } from 'next/headers'

export const VIEW_AS_COOKIE = 'peac_view_as'

export interface ViewAs {
  kind: 'coach' | 'athlete'
  id: string
  name: string
}

function readCookie(): ViewAs | null {
  try {
    const raw = cookies().get(VIEW_AS_COOKIE)?.value
    if (!raw) return null
    const v = JSON.parse(raw)
    if ((v?.kind === 'coach' || v?.kind === 'athlete') && typeof v.id === 'string') {
      return { kind: v.kind, id: v.id, name: String(v.name ?? '') }
    }
  } catch { /* bad cookie */ }
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isAdminCached = cache(async (supabase: any): Promise<boolean> => {
  const { data } = await supabase.rpc('is_admin')
  return data === true
})

/** The account an admin is currently viewing as (null when not viewing as anyone) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getViewAs(supabase: any): Promise<ViewAs | null> {
  const v = readCookie()
  if (!v) return null
  return (await isAdminCached(supabase)) ? v : null
}

/** Filter for "the current coach": the viewed coach for admins, otherwise the signed-in coach */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function coachMatch(supabase: any, userId: string): Promise<Record<string, string>> {
  const v = await getViewAs(supabase)
  return v?.kind === 'coach' ? { id: v.id } : { user_id: userId }
}

/** Filter for "the current athlete": the viewed athlete for admins, otherwise the signed-in athlete */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function athleteMatch(supabase: any, userId: string): Promise<Record<string, string>> {
  const v = await getViewAs(supabase)
  return v?.kind === 'athlete' ? { id: v.id } : { user_id: userId }
}
