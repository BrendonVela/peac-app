import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AthleteNav } from '@/components/layout/AthleteNav'
import { ViewAsBanner } from '@/components/ViewAsBanner'
import { getViewAs } from '@/lib/acting'

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const viewAs = await getViewAs(supabase)
  const viewingAthlete = viewAs?.kind === 'athlete'
  if (user.user_metadata?.role !== 'athlete' && !viewingAthlete) redirect('/coach/dashboard')

  return (
    <div className="min-h-screen bg-zinc-950">
      <AthleteNav />
      <main className="md:ml-60 min-h-screen">
        {viewingAthlete && <ViewAsBanner viewAs={viewAs!} />}
        <div className="pt-14 md:pt-0 px-4 md:px-8 py-6 md:py-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
