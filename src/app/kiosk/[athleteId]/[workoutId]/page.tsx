import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { WorkoutView } from '@/app/athlete/workout/[id]/WorkoutView'
import { IdleReturn } from '../../KioskBits'

export const dynamic = 'force-dynamic'

export default async function KioskWorkout({ params }: { params: { athleteId: string; workoutId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [{ data: coach }, { data: athlete }, { data: isAdmin }] = await Promise.all([
    supabase.from('coaches').select('id').match(await coachMatch(supabase, user.id)).maybeSingle(),
    supabase.from('athletes').select('id, name, coach_id').eq('id', params.athleteId).maybeSingle(),
    supabase.rpc('is_admin'),
  ])
  if (!athlete) notFound()
  if (athlete.coach_id !== coach?.id && isAdmin !== true) redirect('/kiosk')

  return (
    <div className="space-y-4">
      <IdleReturn />
      <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-600/30 bg-blue-600/10 px-4 py-3">
        <p className="text-sm text-blue-100">Logging for <b>{athlete.name}</b></p>
        <Link href="/kiosk" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Done — next athlete</Link>
      </div>
      <WorkoutView athleteId={athlete.id} workoutId={params.workoutId} backHref={`/kiosk/${athlete.id}`} kiosk />
    </div>
  )
}
