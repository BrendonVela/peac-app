import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPanel, type Person, type CoachInvite } from './AdminPanel'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) redirect('/coach/dashboard')

  const [{ data: people, error }, { data: invites }, { data: codeRow }] = await Promise.all([
    supabase.rpc('admin_list_people'),
    supabase.from('coach_invites').select('*').order('created_at', { ascending: false }),
    supabase.from('app_settings').select('value').eq('key', 'coach_signup_code').maybeSingle(),
  ])

  const me = ((people ?? []) as Person[]).find(p => p.kind === 'coach' && p.user_id === user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Manage every coach and athlete in PEAC.</p>
      </div>
      {error ? (
        <p className="text-sm text-red-400">Could not load people: {error.message}</p>
      ) : (
        <AdminPanel
          people={(people ?? []) as Person[]}
          invites={(invites ?? []) as CoachInvite[]}
          myCoachId={me?.id ?? null}
          coachCode={codeRow?.value ?? null}
        />
      )}
    </div>
  )
}
