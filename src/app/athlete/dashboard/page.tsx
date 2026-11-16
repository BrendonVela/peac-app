import { createClient } from '@/lib/supabase/server'
import { athleteMatch } from '@/lib/acting'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Dumbbell, ChevronRight, CalendarDays, AlertTriangle, CheckCircle2, Play } from 'lucide-react'
import { VideoBackground } from '@/components/brand/VideoBackground'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { getReadinessBadge, getReadinessLabel } from '@/lib/utils'
import {
  getAthleteSchedule, formatMonthDay, formatWeekday, formatShortDate, addDays,
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

  const schedule = await getAthleteSchedule(supabase, athlete.id, { athleteView: true })
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

  // ---------- Hero: the next workout to do ----------
  const pending = thisWeek
    .filter(i => i.status !== 'done')
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate) || a.dayNumber - b.dayNumber)
  const upNext = pending.find(i => i.plannedDate === today)
    ?? pending.find(i => i.status === 'in_progress')
    ?? pending.find(i => i.plannedDate > today)
    ?? pending[0]
    ?? null
  const weekDone = thisWeek.filter(i => i.status === 'done').length
  const allTimeDone = schedule.items.filter(i => i.status === 'done').length
  const weekComplete = thisWeek.length > 0 && weekDone === thisWeek.length

  // ---------- Week strip (Mon–Sun) ----------
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7 // 0 = Monday
  const monday = addDays(today, -dow)
  const days = Array.from({ length: 7 }, (_, k) => {
    const date = addDays(monday, k)
    const onDay = thisWeek.filter(i => (i.completedDate ?? i.plannedDate) === date)
    const done = onDay.length > 0 && onDay.every(i => i.status === 'done')
    return {
      date,
      letter: 'MTWTFSS'[k],
      num: Number(date.slice(8)),
      kind: done ? 'done' : date === today ? 'today' : onDay.length > 0 ? 'planned' : 'rest',
    }
  })
  const firstName = athlete.name.split(' ')[0]
  const coachName = ((athlete as any).coaches as any)?.name as string | undefined

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-400 font-medium">
          {formatWeekday(today)}, {formatMonthDay(today)}{coachName ? ` · Coach ${coachName}` : ''}
        </p>
        <h1 className="mt-1">Let&apos;s work, {firstName}</h1>
      </div>

      {/* Hero: next workout */}
      <section className="relative overflow-hidden rounded-3xl min-h-[280px] flex flex-col justify-end">
        <VideoBackground clip="home" overlay="card" />
        <div className="relative p-5 sm:p-6 space-y-3">
          {upNext ? (
            <>
              <span className="inline-block rounded-full bg-blue-500 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-ink">
                {upNext.status === 'in_progress' ? 'Keep going' : upNext.plannedDate === today ? "Today's workout" : `Up next · ${formatWeekday(upNext.plannedDate)}`}
              </span>
              <h2 className="font-display italic font-extrabold uppercase text-4xl sm:text-5xl leading-[0.95]">{upNext.title}</h2>
              <p className="text-sm text-zinc-300">
                {upNext.programTitle} · Week {upNext.weekNumber} · {upNext.exerciseCount} exercises
                {upNext.doneCount > 0 ? ` · ${upNext.doneCount} done` : ''}
              </p>
              <Link
                href={`/athlete/workout/${upNext.workoutId}`}
                className="mt-1 flex h-14 items-center justify-center gap-2 rounded-2xl bg-blue-500 font-display text-xl font-extrabold uppercase tracking-wider text-ink hover:brightness-110 sm:max-w-xs"
              >
                <Play className="w-5 h-5 fill-ink" />
                {upNext.status === 'in_progress' ? 'Continue workout' : 'Start workout'}
              </Link>
            </>
          ) : weekComplete ? (
            <>
              <span className="peac-pop inline-flex w-14 h-14 items-center justify-center rounded-full bg-volt">
                <CheckCircle2 className="w-8 h-8 text-ink" />
              </span>
              <h2 className="font-display italic font-extrabold uppercase text-4xl leading-[0.95]">Week done.</h2>
              <p className="text-sm text-zinc-300">Every workout this week is finished. Recover well.</p>
            </>
          ) : (
            <>
              <h2 className="font-display italic font-extrabold uppercase text-4xl leading-[0.95]">Rest day</h2>
              <p className="text-sm text-zinc-300">
                {notStarted.length > 0 ? `Your program starts ${formatShortDate(notStarted[0].startDate)}.` : 'No workouts this week. Rest up.'}
              </p>
            </>
          )}
        </div>
      </section>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-panel p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">This week</p>
          <p className="mt-1 font-display text-4xl font-extrabold leading-none">
            {weekDone}<span className="text-lg text-zinc-400"> / {thisWeek.length} done</span>
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-panel p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Workouts done</p>
          <p className="mt-1 font-display text-4xl font-extrabold leading-none">
            {allTimeDone}<span className="text-lg text-zinc-400"> total</span>
          </p>
        </div>
      </div>

      {/* Week strip */}
      <Link href="/athlete/calendar" className="block rounded-2xl border border-line bg-panel p-4" aria-label="Open calendar">
        <div className="grid grid-cols-7 gap-1 text-center">
          {days.map(d => (
            <div key={d.date} className="flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-zinc-400">{d.letter}</span>
              <span
                className={
                  'flex w-9 h-9 items-center justify-center rounded-full text-sm font-bold ' +
                  (d.kind === 'done' ? 'bg-volt text-ink'
                    : d.kind === 'today' ? 'border-2 border-blue-500 text-white'
                    : d.kind === 'planned' ? 'bg-panel2 text-white'
                    : 'text-zinc-600')
                }
              >
                {d.num}
              </span>
            </div>
          ))}
        </div>
      </Link>

      {dueForms.length > 0 && (
        <Link href={dueForms.length === 1 ? `/athlete/forms/${dueForms[0].id}` : '/athlete/forms'} className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <span className="text-xl" aria-hidden="true">📋</span>
          <span className="flex-1 text-sm text-amber-100">
            Your coach needs you to fill out <b>{dueForms.length === 1 ? dueForms[0].title : `${dueForms.length} forms`}</b>.
          </span>
          <span className="text-xs font-semibold text-amber-300">Open →</span>
        </Link>
      )}

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
                    {first.programTitle} · Week {first.weekNumber}{first.totalWeeks ? ` of ${first.totalWeeks}` : ''} · {formatMonthDay(first.weekStart)} – {formatMonthDay(first.weekEnd)}
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
              : 'No workouts this week. Rest up!'}
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

