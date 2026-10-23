import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { getAthleteSchedule, todayISO, calendarDate, startOfWeek, addDays, formatShortDate, STATUS_LABEL } from '@/lib/schedule'
import { IdleReturn } from '../KioskBits'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function KioskAthlete({ params }: { params: { athleteId: string } }) {
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

  const schedule = await getAthleteSchedule(supabase, athlete.id)
  const today = todayISO()
  const weekStart = startOfWeek(today)
  const weekEnd = addDays(weekStart, 7)
  const todays = schedule.items.filter(it => calendarDate(it) === today || (it.plannedDate === today && it.status !== 'done'))
  const week = schedule.items
    .filter(it => it.plannedDate >= weekStart && it.plannedDate < weekEnd && !todays.includes(it))
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))

  const Row = ({ it, big = false }: { it: (typeof schedule.items)[number]; big?: boolean }) => (
    <Link
      href={`/kiosk/${athlete.id}/${it.workoutId}`}
      className={cn(
        'flex items-center gap-4 rounded-2xl border bg-zinc-900 active:scale-[0.99] transition-transform',
        big ? 'p-5 border-blue-600/40' : 'p-4 border-zinc-800'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold text-white', big ? 'text-xl' : 'text-base')}>{it.title}</p>
        <p className="text-sm text-zinc-400">
          {formatShortDate(it.plannedDate)} · Week {it.weekNumber} · {it.doneCount}/{it.exerciseCount} exercises
        </p>
      </div>
      {it.status === 'done' ? (
        <span className="flex items-center gap-1 text-sm text-green-400"><CheckCircle2 className="w-5 h-5" /> Done</span>
      ) : (
        <span className="text-sm text-zinc-400">{STATUS_LABEL[it.status]}</span>
      )}
      <ChevronRight className="w-6 h-6 text-zinc-500" />
    </Link>
  )

  return (
    <div className="space-y-6">
      <IdleReturn />
      <div className="flex items-center gap-3">
        <Link href="/kiosk" className="flex items-center gap-1 rounded-xl border border-zinc-800 px-4 py-3 text-zinc-300">
          <ArrowLeft className="w-5 h-5" /> Not me
        </Link>
        <h1 className="text-2xl font-bold truncate">Hi, {athlete.name.split(' ')[0]}</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Today</h2>
        {todays.length ? todays.map(it => <Row key={it.workoutId} it={it} big />) : (
          <p className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-400">No workout scheduled today.</p>
        )}
      </section>

      {week.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Rest of this week</h2>
          {week.map(it => <Row key={it.workoutId} it={it} />)}
        </section>
      )}
    </div>
  )
}
