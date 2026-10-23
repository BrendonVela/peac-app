import { redirect } from 'next/navigation'
import { Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { getTeamSchedules, todayISO, calendarDate, type AthleteSchedule } from '@/lib/schedule'
import { AthleteTiles, HoldToExit } from './KioskBits'
import { brandFromRow } from '@/lib/brand'

export const dynamic = 'force-dynamic'

export default async function KioskHome() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: coach } = await supabase.from('coaches').select('id, name').match(await coachMatch(supabase, user.id)).maybeSingle()
  if (!coach) redirect('/login')
  const { data: brandRow } = await supabase.from('coaches').select('brand_name, brand_color, brand_logo_path').eq('id', coach.id).maybeSingle()
  const brand = brandFromRow(brandRow)

  const { data: athletes } = await supabase.from('athletes').select('id, name').eq('coach_id', coach.id).order('name')
  const today = todayISO()
  const roster = (athletes ?? []) as { id: string; name: string }[]
  const team = await getTeamSchedules(supabase, roster.map(a => a.id)).catch(() => new Map<string, AthleteSchedule>())
  const list = await Promise.all(
    roster.map(async a => {
      const s = team.get(a.id) ?? null
      const count = (s?.items ?? []).filter(it => calendarDate(it) === today || (it.plannedDate === today && it.status !== 'done')).length
      return { id: a.id, name: a.name, today: count }
    })
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand!.logoUrl!} alt="" className="h-10 w-auto max-w-[8rem] object-contain" />
          ) : (
            <Zap className="w-8 h-8 text-blue-500 fill-blue-500" />
          )}
          <div>
            <h1 className="text-2xl font-bold">{brand?.name ? `${brand.name} Weight Room` : 'Weight Room'}</h1>
            <p className="text-sm text-zinc-400">Tap your name to start your workout</p>
          </div>
        </div>
        <HoldToExit />
      </div>
      <AthleteTiles athletes={list} />
    </div>
  )
}
