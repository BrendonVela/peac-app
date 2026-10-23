import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getViewAs } from '@/lib/acting'
import { AccountSettings } from '@/components/settings/AccountSettings'
import { ReadinessSettings } from '@/components/settings/ReadinessSettings'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: rules }, viewAs] = await Promise.all([
    supabase.from('coaches').select('name, head_coach_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('coaches').select('readiness_on, readiness_low, readiness_cut').eq('user_id', user.id).maybeSingle(),
    getViewAs(supabase),
  ])
  const isAssistant = !!(profile as any)?.head_coach_id

  return (
    <AccountSettings
      email={user.email ?? ''}
      name={profile?.name ?? user.user_metadata?.name ?? ''}
      role="coach"
      viewingAs={viewAs?.name ?? null}
      extra={
        !viewAs && !isAssistant && rules ? (
          <ReadinessSettings initial={{ on: rules.readiness_on, low: Number(rules.readiness_low), cut: rules.readiness_cut }} />
        ) : null
      }
    />
  )
}
