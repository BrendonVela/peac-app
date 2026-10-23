import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getViewAs, coachMatch } from '@/lib/acting'
import { brandFromRow, brandStyle } from '@/lib/brand'

export const metadata = { title: 'PEAC — Weight Room' }

/** Weight-room tablet mode: signed in as the coach, no menus, big buttons */
export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/kiosk')
  const viewAs = await getViewAs(supabase)
  if (user.user_metadata?.role !== 'coach' || viewAs?.kind === 'athlete') redirect('/athlete/dashboard')

  const { data: team } = await supabase.from('coaches').select('brand_name, brand_color, brand_logo_path').match(await coachMatch(supabase, user.id)).maybeSingle()
  const brand = brandFromRow(team)

  return (
    <div className={`kiosk min-h-screen bg-zinc-950 ${brand?.color ? 'branded' : ''}`} style={brandStyle(brand)}>
      <div className="mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-8" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
        {children}
      </div>
    </div>
  )
}
