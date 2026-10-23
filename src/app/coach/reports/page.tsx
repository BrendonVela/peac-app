import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { getTeamSchedules, todayISO, addDays, toLocalISO, type AthleteSchedule } from '@/lib/schedule'
import { fetchAll } from '@/lib/fetchAll'
import { sessionLoad } from '@/lib/load'
import { ReportView, type ReportRow } from './ReportView'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PERIODS = [7, 14, 28]

export default async function ReportsPage({ searchParams }: { searchParams: { days?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: coach } = await supabase.from('coaches').select('id').match(await coachMatch(supabase, user.id)).maybeSingle()
  if (!coach) redirect('/login')

  const days = PERIODS.includes(Number(searchParams.days)) ? Number(searchParams.days) : 7
  const today = todayISO()
  const from = addDays(today, -(days - 1))

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, user_id')
    .eq('coach_id', coach.id)
    .order('name')
  const list = (athletes ?? []) as { id: string; name: string; user_id: string | null }[]
  const ids = list.map(a => a.id)

  const [{ data: checkins }, { data: sessions }, { data: lastLogs }] = ids.length
    ? await Promise.all([
        supabase.from('check_ins').select('athlete_id, date, readiness_score').in('athlete_id', ids).gte('date', from),
        supabase.from('workout_sessions').select('athlete_id, rpe, minutes, completed_at').in('athlete_id', ids).gte('completed_at', `${from}T00:00:00`),
        fetchAll<any>((from, to) => supabase.from('workout_results').select('athlete_id, logged_at').in('athlete_id', ids).order('logged_at', { ascending: false }).range(from, to), 1000, 20000),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const lastActive = new Map<string, string>()
  ;(lastLogs ?? []).forEach((r: any) => { if (!lastActive.has(r.athlete_id)) lastActive.set(r.athlete_id, toLocalISO(r.logged_at)) })

  const teamSchedules = await getTeamSchedules(supabase, ids).catch(() => new Map<string, AthleteSchedule>())
  const schedules = list.map(a => teamSchedules.get(a.id) ?? null)

  const rows: ReportRow[] = list.map((a, i) => {
    const sched = schedules[i]
    const due = (sched?.items ?? []).filter(it => it.plannedDate >= from && it.plannedDate <= today)
    const done = due.filter(it => it.status === 'done').length
    const partial = due.filter(it => it.status === 'in_progress').length
    const missed = due.filter(it => it.status === 'missed').length
    const ci = (checkins ?? []).filter((c: any) => c.athlete_id === a.id)
    const ss = (sessions ?? []).filter((s: any) => s.athlete_id === a.id)
    const loads = ss.map((s: any) => sessionLoad(s)).filter((x: number | null): x is number => x != null)
    const readiness = ci.length ? Math.round((ci.reduce((n: number, c: any) => n + Number(c.readiness_score ?? 0), 0) / ci.length) * 10) / 10 : null
    return {
      athleteId: a.id,
      name: a.name,
      signedUp: !!a.user_id,
      hasProgram: (sched?.assignments.length ?? 0) > 0,
      due: due.length,
      done,
      partial,
      missed,
      compliance: due.length ? Math.round((done / due.length) * 100) : null,
      checkIns: ci.length,
      avgReadiness: readiness,
      avgRpe: ss.length ? Math.round((ss.reduce((n: number, s: any) => n + s.rpe, 0) / ss.length) * 10) / 10 : null,
      load: loads.reduce((n: number, x: number) => n + x, 0),
      lastActive: lastActive.get(a.id) ?? null,
    }
  })

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Who&apos;s getting their work in — workouts done vs. scheduled, check-ins and effort.</p>
      </div>
      <ReportView rows={rows} days={days} periods={PERIODS} from={from} to={today} />
    </div>
  )
}
