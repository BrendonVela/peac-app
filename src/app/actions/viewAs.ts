'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VIEW_AS_COOKIE } from '@/lib/acting'

/** Admin opens the app as a coach or athlete */
export async function startViewAs(kind: 'coach' | 'athlete', id: string) {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'Not allowed' }

  const { data: person } = await supabase
    .from(kind === 'coach' ? 'coaches' : 'athletes')
    .select('id, name')
    .eq('id', id)
    .single()
  if (!person) return { error: 'Not found' }

  cookies().set(VIEW_AS_COOKIE, JSON.stringify({ kind, id: person.id, name: person.name }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  redirect(kind === 'coach' ? '/coach/dashboard' : '/athlete/dashboard')
}

/** Back to the admin's own account */
export async function stopViewAs() {
  cookies().delete(VIEW_AS_COOKIE)
  redirect('/coach/admin')
}

/** For client pages that need the current coach's id */
export async function getActingCoachId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { coachMatch } = await import('@/lib/acting')
  const { data } = await supabase.from('coaches').select('id').match(await coachMatch(supabase, user.id)).maybeSingle()
  return data?.id ?? null
}
