import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getViewAs } from '@/lib/acting'
import { AccountSettings } from '@/components/settings/AccountSettings'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = user.user_metadata?.role === 'coach' ? 'coach' : 'athlete'
  const [{ data: profile }, viewAs] = await Promise.all([
    supabase.from(role === 'coach' ? 'coaches' : 'athletes').select('name').eq('user_id', user.id).maybeSingle(),
    getViewAs(supabase),
  ])

  return (
    <AccountSettings
      email={user.email ?? ''}
      name={profile?.name ?? user.user_metadata?.name ?? ''}
      role={role}
      viewingAs={viewAs?.name ?? null}
    />
  )
}
