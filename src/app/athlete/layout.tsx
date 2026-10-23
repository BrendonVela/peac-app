import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AthleteNav } from '@/components/layout/AthleteNav'
import { ViewAsBanner } from '@/components/ViewAsBanner'
import { getViewAs, athleteMatch } from '@/lib/acting'
import { brandFromRow, brandStyle } from '@/lib/brand'

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const viewAs = await getViewAs(supabase)
  const viewingAthlete = viewAs?.kind === 'athlete'
  if (user.user_metadata?.role !== 'athlete' && !viewingAthlete) redirect('/coach/dashboard')

  const { data: me } = await supabase
    .from('athletes')
    .select('coaches(brand_name, brand_color, brand_logo_path)')
    .match(await athleteMatch(supabase, user.id))
    .maybeSingle()
  const brand = brandFromRow((me as any)?.coaches)

  return (
    <div className={`min-h-screen bg-zinc-950 ${brand?.color ? 'branded' : ''}`} style={brandStyle(brand)}>
      <AthleteNav brand={brand ? { name: brand.name, logoUrl: brand.logoUrl } : null} />
      <main className="md:ml-60 min-h-screen">
        {viewingAthlete && <ViewAsBanner viewAs={viewAs!} />}
        <div className="mobile-main px-4 md:px-8 py-6 md:py-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
