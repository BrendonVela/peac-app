import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getViewAs } from '@/lib/acting'

export const metadata = { title: 'PEAC — Weight Room' }

/** Weight-room tablet mode: signed in as the coach, no menus, big buttons */
export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/kiosk')
  const viewAs = await getViewAs(supabase)
  if (user.user_metadata?.role !== 'coach' || viewAs?.kind === 'athlete') redirect('/athlete/dashboard')

  return (
    <div className="kiosk min-h-screen bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-8" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
        {children}
      </div>
    </div>
  )
}
