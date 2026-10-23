import { createClient } from '@/lib/supabase/server'
import { athleteMatch } from '@/lib/acting'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Dumbbell, ChevronRight, Heart, CalendarDays, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { getReadinessBadge, getReadinessLabel } from '@/lib/utils'
import {
  getAthleteSchedule, formatMonthDay, formatWeekday, formatShortDate,
  STATUS_LABEL, STATUS_BADGE, type ScheduledWorkout,
} from '@/lib/schedule'
import { getMyForms } from '@/lib/dueForms'

export default async function AthleteDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, name, coach_id, coaches(name)')
    .match(await athleteMatch(supabase, user.id))
    .single()

  if (!athlete) redirect('/login')

  const schedule = await getAthleteSchedule(supabase, athlete.id)
  const today = schedule.today

  const [{ data: checkIn }, { data: recentTests }] = await Promise.all([
    supabase
      .from('check_ins')
      .select('*')
      .eq('athlete_id', athlete.id)
      .eq('date', today)
      .single(),
    supabase
      .from('performance_tests')
      .select('test_type, result, unit, date')
      .eq('athlete_id', athlete.id)
      .order('date', { ascending: false })
      .limit(3),
  ])

  // This week's workouts, grouped by program
  const thisWeek = schedule.items.filter(i => i.weekStart <= today && today <= i.weekEnd)
  const weekGroups = new Map<string, ScheduledWorkout[]>()
  thisWeek.forEach(i => {
    const list = weekGroups.get(i.programId) ?? []
    list.push(i)
    weekGroups.set(i.programId, list)
  })
  const groups = Array.from(weekGroups.values()).map(list =>
    list.sort((a, b) => a.plannedDate.localeCompare(b.plannedDate) || a.dayNumber - b.dayNumber)
  )

  // Programs that haven't started yet
  const notStarted = schedule.assignments.filter(a => a.startDate > today)

  // Past weeks that weren't finished (most recent first)
  const missed = schedule.items
    .filter(i => i.status === 'missed')
    .sort((a, b) => b.plannedDate.localeCompare(a.plannedDate))

  const { due: dueForms } = await getMyForms(supabase, athlete.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hey, {athlete.name.split(' ')[0]} 👊</h1>
        {(athlete as any).coaches && (
          <p className="text-zinc-400 text-sm mt-0.5">
            Coach: {((athlete as any).coaches as any).name}
          </p>
        )}
      </div>

      {dueForms.length > 0 && (
        <Link href={dueForms.length === 1 ? `/athlete/forms/${dueForms[0].id}` : '/athlete/forms'} className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <span className="text-xl">📋</span>
          <span className="flex-1 text-sm text-amber-100">
            Your coach needs you to fill out <b>{dueForms.length === 1 ? dueForms[0].title : `${dueForms.length} forms`}</b>.
          </span>
          <span className="text-xs font-semibold text-amber-300">Open →</span>
        </Link>
      )}

      {/* Readiness */}
      <Card className={!checkIn ? 'border-yellow-500/30' : ''}>
        <CardContent className="py-5">
          {checkIn ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">Today&apos;s Readiness</p>
                <div className={`inline-flex px-3 py-1.5 rounded-full text-sm font-bold ${getReadinessBadge(checkIn.readiness_score)}`}>
                  {getReadinessLabel(checkIn.readiness_score)} — {checkIn.readiness_score.toFixed(1)}/10
                </div>
              </div>
              <Link href="/athlete/checkin">
                <Button variant="ghost" size="sm">Update</Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">Daily Check-In</p>
                <p className="text-sm text-zinc-300">How are you feeling today?</p>
              </div>
              <Link href="/athlete/checkin">
                <Button size="sm">
                  <Heart className="w-4 h-4" />
                  Check In
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* This Week */}
      {groups.length > 0 ? (
        groups.map(list => {
          const first = list[0]
          const doneCount = list.filter(i => i.status === 'done').length
          return (
            <Card key={first.programId}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle>This Week</CardTitle>
                  <p className="text-xs text-zinc-500 mt-1 truncate">
                    {first.programTitle} · Week {first.weekNumber} of {first.totalWeeks} · {formatMonthDay(first.weekStart)} – {formatMonthDay(first.weekEnd)}
                  </p>
                </div>
                <Badge variant={doneCount === list.length ? 'green' : 'blue'} className="shrink-0">
                  {doneCount}/{list.length} done
                </Badge>
              </CardHeader>
              <CardContent className="px-0 py-0">
                <div className="divide-y divide-zinc-800">
                  {list.map(item => (
                    <Link
                      key={item.workoutId}
                      href={`/athlete/workout/${item.workoutId}`}
                      className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg shrink-0 ${item.status === 'done' ? 'bg-green-600/10' : 'bg-blue-600/10'}`}>
                          {item.status === 'done'
                            ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                            : <Dumbbell className="w-4 h-4 text-blue-400" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{item.title}</p>
                          <p className="text-xs text-zinc-500">
                            {item.status === 'done' && item.completedDate
                              ? `Done ${formatWeekday(item.completedDate)}`
                              : item.plannedDate === today
                                ? 'Planned today'
                                : `Planned ${formatWeekday(item.plannedDate)}`}
                            {' · '}{item.doneCount}/{item.exerciseCount} exercises
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={STATUS_BADGE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                        <ChevronRight className="w-4 h-4 text-zinc-600" />
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between">
                  <p className="text-xs text-zinc-500">Do them in any order.</p>
                  <Link href="/athlete/calendar" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" /> Calendar
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>This Week</CardTitle>
            <Link href="/athlete/calendar" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" /> Calendar
            </Link>
          </CardHeader>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            {notStarted.length > 0
              ? `Your program starts ${formatShortDate(notStarted[0].startDate)}.`
              : 'No workouts this week. Rest up! 💤'}
          </CardContent>
        </Card>
      )}

      {/* Missed */}
      {missed.length > 0 && (
        <Card className="border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Not Finished
            </CardTitle>
            <Badge variant="red">{missed.length}</Badge>
          </CardHeader>
          <CardContent className="px-0 py-0">
            <div className="divide-y divide-zinc-800">
              {missed.slice(0, 5).map(item => (
                <Link
                  key={item.workoutId}
                  href={`/athlete/workout/${item.workoutId}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.title}</p>
                    <p className="text-xs text-zinc-500">
                      Week {item.weekNumber} · {item.doneCount}/{item.exerciseCount} exercises
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
                </Link>
              ))}
            </div>
            {missed.length > 5 && (
              <div className="px-5 py-3 border-t border-zinc-800">
                <Link href="/athlete/calendar" className="text-xs text-blue-400 hover:text-blue-300">
                  See all {missed.length} in the calendar
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Tests */}
      {recentTests && recentTests.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Performance</CardTitle>
            <Link href="/athlete/progress" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="px-0 py-0 divide-y divide-zinc-800">
            {recentTests.map((test: any, i: any) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5">
                <p className="text-sm text-zinc-300">{test.test_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                <span className="text-base font-bold text-blue-400">{test.result} <span className="text-xs font-normal text-zinc-500">{test.unit}</span></span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

