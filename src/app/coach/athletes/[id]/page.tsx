import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getReadinessBadge, getReadinessLabel, formatDate, TEST_META } from '@/lib/utils'
import { AddPerformanceTestForm } from './AddPerformanceTestForm'
import { StartDateForm } from './StartDateForm'
import { MaxesForm } from './MaxesForm'
import { ManageAthlete } from './ManageAthlete'
import { LinkAccount, type SignedUpAthlete } from './LinkAccount'
import { LiftProgress } from '@/components/LiftProgress'
import { TrainingLoad } from './TrainingLoad'
import type { SessionRow } from '@/lib/load'
import { getLiftHistory } from '@/lib/liftHistory'
import { ScheduleCalendar } from '@/components/ScheduleCalendar'
import { getAthleteSchedule, formatMonthDay } from '@/lib/schedule'

export default async function AthleteDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { month?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: athlete } = await supabase
    .from('athletes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!athlete) notFound()

  const [{ data: checkIns }, { data: tests }, schedule, { data: maxRows }, lifts, { data: isAdmin }, { data: sessionRows }] = await Promise.all([
    supabase
      .from('check_ins')
      .select('*')
      .eq('athlete_id', params.id)
      .order('date', { ascending: false })
      .limit(7),
    supabase
      .from('performance_tests')
      .select('*')
      .eq('athlete_id', params.id)
      .order('date', { ascending: false }),
    getAthleteSchedule(supabase, params.id),
    supabase.from('athlete_maxes').select('lift, value, updated_at').eq('athlete_id', params.id),
    getLiftHistory(supabase, params.id),
    supabase.rpc('is_admin'),
    supabase
      .from('workout_sessions')
      .select('workout_id, rpe, minutes, notes, completed_at, workouts(title)')
      .eq('athlete_id', params.id)
      .order('completed_at', { ascending: false })
      .limit(200),
  ])

  // Hand-added athlete with no login: offer to combine with the account they made
  let linkCandidates: SignedUpAthlete[] | null = null
  if (!athlete.user_id && athlete.coach_id) {
    const { data } = await supabase
      .from('athletes')
      .select('id, name, created_at')
      .eq('coach_id', athlete.coach_id)
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false })
    linkCandidates = (data ?? []) as SignedUpAthlete[]
  }

  const maxes: Record<string, number> = {}
  let maxesUpdated: string | null = null
  ;(maxRows ?? []).forEach((m: any) => {
    maxes[m.lift] = Number(m.value)
    if (!maxesUpdated || m.updated_at > maxesUpdated) maxesUpdated = m.updated_at
  })

  const today = schedule.today
  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? '') ? searchParams.month! : today.slice(0, 7)

  const latestCheckIn = checkIns?.[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/coach/athletes" className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{athlete.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {athlete.sport && <Badge variant="blue">{athlete.sport}</Badge>}
            {athlete.position && <Badge>{athlete.position}</Badge>}
            {athlete.graduation_year && (
              <span className="text-sm text-zinc-500">Class of {athlete.graduation_year}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Readiness */}
        <Card>
          <CardContent className="py-5">
            <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-2">Today&apos;s Readiness</p>
            {latestCheckIn && latestCheckIn.date === today ? (
              <div>
                <div className={`inline-flex px-2.5 py-1 rounded-full text-sm font-semibold mb-3 ${getReadinessBadge(latestCheckIn.readiness_score)}`}>
                  {getReadinessLabel(latestCheckIn.readiness_score)} — {latestCheckIn.readiness_score.toFixed(1)}/10
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ['Sleep', latestCheckIn.sleep_quality],
                    ['Energy', latestCheckIn.energy],
                    ['Stress', latestCheckIn.stress],
                    ['Soreness', latestCheckIn.soreness],
                    ['Motivation', latestCheckIn.motivation],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between text-zinc-400">
                      <span>{label}</span>
                      <span className="text-white font-medium">{val}/10</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No check-in today</p>
            )}
          </CardContent>
        </Card>

        {/* Assigned Programs */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Assigned Programs</CardTitle>
          </CardHeader>
          <CardContent className="py-3">
            {schedule.assignments.length > 0 ? (
              <div className="space-y-2">
                {schedule.assignments.map(a => {
                  const mine = schedule.items.filter(i => i.programId === a.programId)
                  const current = mine.find(i => i.weekStart <= today && today <= i.weekEnd)
                  const done = mine.filter(i => i.status === 'done').length
                  const missed = mine.filter(i => i.status === 'missed').length
                  return (
                    <div key={a.id} className="px-3 py-2.5 rounded-lg bg-zinc-800/50 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Link href={`/coach/programs/${a.programId}`} className="text-sm text-white hover:text-blue-300 truncate">
                          {a.programTitle}
                        </Link>
                        <span className="text-xs text-zinc-500 shrink-0">
                          {current
                            ? `Week ${current.weekNumber} of ${a.totalWeeks} · ${formatMonthDay(current.weekStart)}–${formatMonthDay(current.weekEnd)}`
                            : a.startDate > today ? 'Not started' : 'Finished'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StartDateForm assignmentId={a.id} athleteId={params.id} startDate={a.startDate} />
                        <span className="text-xs text-zinc-500">
                          <span className="text-green-400">{done} done</span>
                          {missed > 0 && <> · <span className="text-red-400">{missed} missed</span></>}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No programs assigned.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 1-Rep Maxes */}
      <Card>
        <CardHeader>
          <CardTitle>1-Rep Maxes</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <MaxesForm athleteId={params.id} initial={maxes} updatedAt={maxesUpdated} />
        </CardContent>
      </Card>

      <TrainingLoad sessions={(sessionRows ?? []) as unknown as SessionRow[]} />

      {/* Main lift progress */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Main Lift Progress</h2>
        <LiftProgress lifts={lifts} emptyText="No main-lift sets logged yet." />
      </div>

      {/* Training Calendar */}
      {schedule.assignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Training Calendar</CardTitle>
            <p className="text-xs text-zinc-500 mt-1">Click a workout to move it to a different day for {athlete.name.split(' ')[0]}.</p>
          </CardHeader>
          <CardContent className="pt-0">
            <ScheduleCalendar
              items={schedule.items}
              athleteId={params.id}
              today={today}
              month={month}
              basePath={`/coach/athletes/${params.id}`}
              mode="coach"
            />
          </CardContent>
        </Card>
      )}

      {/* Performance Tests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Performance Tests</CardTitle>
          <AddPerformanceTestForm athleteId={params.id} />
        </CardHeader>
        <CardContent className="px-0 py-0">
          {tests && tests.length > 0 ? (
            <div className="divide-y divide-zinc-800">
              {tests.map(test => (
                <div key={test.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-white">{TEST_META[test.test_type as keyof typeof TEST_META]?.label}</p>
                    <p className="text-xs text-zinc-500">{formatDate(test.date)}</p>
                  </div>
                  <span className="text-lg font-bold text-blue-400">
                    {test.result} <span className="text-sm font-normal text-zinc-500">{test.unit}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-zinc-500">
              No performance tests recorded yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-in History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Check-Ins</CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {checkIns && checkIns.length > 0 ? (
            <div className="divide-y divide-zinc-800">
              {checkIns.map(ci => (
                <div key={ci.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm text-zinc-400">{formatDate(ci.date)}</p>
                    <div className="flex gap-3 mt-1 text-xs text-zinc-500">
                      <span>Sleep {ci.sleep_quality}</span>
                      <span>Energy {ci.energy}</span>
                      <span>Stress {ci.stress}</span>
                      <span>Soreness {ci.soreness}</span>
                    </div>
                  </div>
                  <div className={`text-xs font-semibold px-2 py-1 rounded-full ${getReadinessBadge(ci.readiness_score)}`}>
                    {ci.readiness_score.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-zinc-500">No check-ins yet.</div>
          )}
        </CardContent>
      </Card>
      {linkCandidates && <LinkAccount athleteId={params.id} name={athlete.name} candidates={linkCandidates} />}

      <ManageAthlete athleteId={params.id} name={athlete.name} isAdmin={isAdmin === true} />
    </div>
  )
}
