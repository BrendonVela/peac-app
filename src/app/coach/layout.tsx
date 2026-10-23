import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CoachNav } from '@/components/layout/CoachNav'
import { ViewAsBanner } from '@/components/ViewAsBanner'
import { getViewAs, coachMatch } from '@/lib/acting'
import { brandFromRow, brandStyle } from '@/lib/brand'

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (user.user_metadata?.role !== 'coach') redirect('/athlete/dashboard')

  const { data: isAdmin } = await supabase.rpc('is_admin')
  const viewAs = await getViewAs(supabase)
  // An admin viewing as an athlete belongs on the athlete side
  if (viewAs?.kind === 'athlete') redirect('/athlete/dashboard')

  const { data: team } = await supabase
    .from('coaches')
    .select('brand_name, brand_color, brand_logo_path')
    .match(await coachMatch(supabase, user.id))
    .maybeSingle()
  const brand = brandFromRow(team)

  return (
    <div className={`min-h-screen bg-zinc-950 ${brand?.color ? 'branded' : ''}`} style={brandStyle(brand)}>
      <CoachNav isAdmin={isAdmin === true} brand={brand ? { name: brand.name, logoUrl: brand.logoUrl } : null} />
      <main className="md:ml-60 min-h-screen">
        {viewAs && <ViewAsBanner viewAs={viewAs} />}
        <div className="mobile-main px-4 md:px-8 py-6 md:py-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
