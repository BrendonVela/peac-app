import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CoachNav } from '@/components/layout/CoachNav'
import { ViewAsBanner } from '@/components/ViewAsBanner'
import { getViewAs } from '@/lib/acting'

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (user.user_metadata?.role !== 'coach') redirect('/athlete/dashboard')

  const { data: isAdmin } = await supabase.rpc('is_admin')
  const viewAs = await getViewAs(supabase)
  // An admin viewing as an athlete belongs on the athlete side
  if (viewAs?.kind === 'athlete') redirect('/athlete/dashboard')

  return (
    <div className="min-h-screen bg-zinc-950">
      <CoachNav isAdmin={isAdmin === true} />
      <main className="md:ml-60 min-h-screen">
        {viewAs && <ViewAsBanner viewAs={viewAs} />}
        <div className="pt-14 md:pt-0 px-4 md:px-8 py-6 md:py-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
