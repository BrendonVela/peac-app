import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStaffInfo, getViewAs } from '@/lib/acting'
import { Card, CardContent } from '@/components/ui/Card'
import { StaffPanel } from './StaffPanel'

export const dynamic = 'force-dynamic'

export default async function StaffPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const viewAs = await getViewAs(supabase)
  const info = await getStaffInfo(supabase, user.id)

  if (info.isAssistant || viewAs) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold">Staff</h1>
        <Card><CardContent className="py-8 text-sm text-zinc-400">
          {viewAs ? 'Staff is managed by each coach from their own account.' : 'You are an assistant coach on this team. Only the head coach can add or remove staff.'}
        </CardContent></Card>
      </div>
    )
  }

  const [{ data: staff }, { data: invites }] = await Promise.all([
    supabase.from('coaches').select('id, name, created_at').eq('head_coach_id', info.ownId),
    supabase.from('coach_invites').select('code, note, expires_at, used_at').eq('head_coach_id', info.ownId).order('created_at', { ascending: false }),
  ])

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Staff</h1>
        <p className="text-zinc-400 text-sm mt-0.5">
          Assistant coaches share your athletes and programs. They can coach, log, edit programs and message athletes — but can&apos;t delete programs or athletes, change your sign-up codes, or manage staff.
        </p>
      </div>
      <StaffPanel
        staff={(staff ?? []) as { id: string; name: string; created_at: string }[]}
        invites={(invites ?? []) as { code: string; note: string | null; expires_at: string; used_at: string | null }[]}
      />
    </div>
  )
}
