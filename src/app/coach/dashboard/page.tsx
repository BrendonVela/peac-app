import Link from 'next/link'
import { coachMatch } from '@/lib/acting'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, CheckCircle2, AlertTriangle, Heart, ChevronRight, BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getReadinessBadge, getReadinessLabel, cn } from '@/lib/utils'
import {
  getTeamSchedules, todayISO, startOfWeek, addDays,
  formatMonthDay, formatWeekday, formatShortDate,
  type ScheduledWorkout,
} from '@/lib/schedule'

interface AthleteRow {
  id: string
  name: string
  sport: string | null
  hasProgram: boolean
  weekDone: number
  weekTotal: number
  weekInProgress: number
  missed: number
  lastWorkout: string | null
  readiness: number | null
  needsAttention: boolean
}

export default async function CoachDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, name')
    .match(await coachMatch(supabase, user.id))
    .single()
  if (!coach) redirect('/login')

  const today = todayISO()
  const weekStart = startOfWeek(today)
  const weekEnd = addDays(weekStart, 6)

  const [{ data: athletes }, { data: programs }] = await Promise.all([
    supabase.from('athletes').select('id, name, sport').eq('coach_id', coach.id).order('name'),
    supabase.from('programs').select('*').eq('coach_id', coach.id).order('created_at', { ascending: false })
      .then((r: any) => ({ ...r, data: (r.data ?? []).filter((p: any) => !p.is_template) })),
  ])

  const athleteList = (athletes ?? []) as { id: string; name: string; sport: string | null }[]
  const athleteIds = athleteList.map(a => a.id)

  const [{ data: checkIns }, schedules] = await Promise.all([
    athleteIds.length > 0
      ? supabase.from('check_ins').select('athlete_id, readiness_score').eq('date', today).in('athlete_id', athleteIds)
      : Promise.resolve({ data: [] as { athlete_id: string; readiness_score: number }[] }),
    getTeamSchedules(supabase, athleteIds).then(m => athleteIds.map(id => m.get(id)!)),
  ])

  const readinessById = new Map<string, number>()
  ;(checkIns ?? []).forEach((c: any) => readinessById.set(c.athlete_id, Number(c.readiness_score)))

  const recent: { athleteId: string; athleteName: string; item: ScheduledWorkout }[] = []

  const rows: AthleteRow[] = athleteList.map((a, idx) => {
    const sched = schedules[idx]
    // "This week" = workouts whose program week includes today
    const week = sched.items.filter(i => i.weekStart <= today && today <= i.weekEnd)
    const missed = sched.items.filter(i => i.status === 'missed').length
    const doneItems = sched.items.filter(i => i.status === 'done' && i.completedDate)
    doneItems.forEach(item => recent.push({ athleteId: a.id, athleteName: a.name, item }))
    const lastWorkout = doneItems.map(i => i.completedDate as string).sort().pop() ?? null
    const readiness = readinessById.has(a.id) ? readinessById.get(a.id)! : null

    return {
      id: a.id,
      name: a.name,
      sport: a.sport,
      hasProgram: sched.assignments.length > 0,
      weekDone: week.filter(i => i.status === 'done').length,
      weekInProgress: week.filter(i => i.status === 'in_progress').length,
      weekTotal: week.length,
      missed,
      lastWorkout,
      readiness,
      needsAttention: missed > 0 || (readiness !== null && readiness < 5),
    }
  })

  // Athletes needing attention first, then least progress this week
  rows.sort((x, y) =>
    Number(y.needsAttention) - Number(x.needsAttention) ||
    y.missed - x.missed ||
    (x.weekTotal ? x.weekDone / x.weekTotal : 1) - (y.weekTotal ? y.weekDone / y.weekTotal : 1) ||
    x.name.localeCompare(y.name)
  )

  recent.sort((x, y) => (y.item.completedDate as string).localeCompare(x.item.completedDate as string))

  const totalDone = rows.reduce((s, r) => s + r.weekDone, 0)
  const totalWeek = rows.reduce((s, r) => s + r.weekTotal, 0)
  const totalMissed = rows.reduce((s, r) => s + r.missed, 0)
  const attentionCount = rows.filter(r => r.needsAttention).length
  const checkedIn = rows.filter(r => r.readiness !== null).length

  const stats = [
    { label: 'Athletes', value: String(rows.length), icon: Users, tone: 'text-blue-400 bg-blue-600/10' },
    { label: 'Workouts done this week', value: `${totalDone}/${totalWeek}`, icon: CheckCircle2, tone: 'text-green-400 bg-green-600/10' },
    { label: 'Missed workouts', value: String(totalMissed), icon: AlertTriangle, tone: totalMissed > 0 ? 'text-red-400 bg-red-600/10' : 'text-zinc-400 bg-zinc-800' },
    { label: 'Checked in today', value: `${checkedIn}/${rows.length}`, icon: Heart, tone: 'text-pink-400 bg-pink-600/10' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {coach.name.split(' ')[0]}</h1>
        <p className="text-zinc-400 text-sm mt-0.5">
          {formatShortDate(today)} · Week of {formatMonthDay(weekStart)} – {formatMonthDay(weekEnd)}
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label}>
            <CardContent className="py-4">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', tone)}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Athletes this week */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Athletes This Week</CardTitle>
          {attentionCount > 0 && <Badge variant="red">{attentionCount} need attention</Badge>}
        </CardHeader>
        <CardContent className="px-0 py-0">
          {rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-zinc-500">
              No athletes yet. <Link href="/coach/athletes" className="text-blue-400 hover:text-blue-300">Add one</Link>
            </div>
          ) : (
            <>
              {/* Column headers (desktop) */}
              <div className="hidden md:grid grid-cols-[1.6fr_1.4fr_0.8fr_1fr_1fr_20px] gap-4 px-5 py-2 border-b border-zinc-800 text-[11px] uppercase font-medium text-zinc-500">
                <span>Athlete</span>
                <span>This week</span>
                <span>Missed</span>
                <span>Last workout</span>
                <span>Readiness</span>
                <span />
              </div>
              <div className="divide-y divide-zinc-800">
                {rows.map(r => {
                  const pct = r.weekTotal ? Math.round((r.weekDone / r.weekTotal) * 100) : 0
                  return (
                    <Link
                      key={r.id}
                      href={`/coach/athletes/${r.id}`}
                      className={cn(
                        'grid grid-cols-2 md:grid-cols-[1.6fr_1.4fr_0.8fr_1fr_1fr_20px] gap-x-4 gap-y-2 items-center px-5 py-3.5 hover:bg-zinc-800/50 transition-colors',
                        r.needsAttention && 'bg-red-500/[0.03]'
                      )}
                    >
                      {/* Athlete */}
                      <div className="col-span-2 md:col-span-1 flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center text-blue-400 font-semibold text-xs shrink-0">
                          {r.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{r.name}</p>
                          {r.sport && <p className="text-xs text-zinc-500 truncate">{r.sport}</p>}
                        </div>
                      </div>

                      {/* This week */}
                      <div className="col-span-2 md:col-span-1">
                        {!r.hasProgram ? (
                          <span className="text-xs text-zinc-600">No program assigned</span>
                        ) : r.weekTotal === 0 ? (
                          <span className="text-xs text-zinc-500">Nothing scheduled</span>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-300">{r.weekDone} of {r.weekTotal} done</span>
                              {r.weekInProgress > 0 && <span className="text-blue-400">{r.weekInProgress} in progress</span>}
                            </div>
                            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                className={cn('h-full rounded-full', pct === 100 ? 'bg-green-500' : 'bg-blue-500')}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Missed */}
                      <div className="text-xs">
                        <span className="md:hidden text-zinc-500">Missed: </span>
                        {r.missed > 0
                          ? <Badge variant="red">{r.missed}</Badge>
                          : <span className="text-zinc-600">—</span>}
                      </div>

                      {/* Last workout */}
                      <div className="text-xs text-zinc-400">
                        <span className="md:hidden text-zinc-500">Last: </span>
                        {r.lastWorkout
                          ? (r.lastWorkout === today ? 'Today' : r.lastWorkout >= addDays(today, -6) ? formatWeekday(r.lastWorkout) : formatMonthDay(r.lastWorkout))
                          : <span className="text-zinc-600">—</span>}
                      </div>

                      {/* Readiness */}
                      <div className="text-xs">
                        {r.readiness !== null ? (
                          <span className={cn('inline-flex px-2 py-0.5 rounded-full font-medium', getReadinessBadge(r.readiness))}>
                            {getReadinessLabel(r.readiness)} {r.readiness.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-zinc-600">No check-in</span>
                        )}
                      </div>

                      <ChevronRight className="hidden md:block w-4 h-4 text-zinc-600" />
                    </Link>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recently Completed</CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {recent.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-zinc-500">No completed workouts yet.</div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {recent.slice(0, 6).map(({ athleteId, athleteName, item }) => (
                  <Link
                    key={`${athleteId}-${item.workoutId}`}
                    href={`/coach/athletes/${athleteId}/workout/${item.workoutId}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/50 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">
                        <span className="font-medium">{athleteName}</span>
                        <span className="text-zinc-400"> finished </span>
                        {item.title}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatShortDate(item.completedDate as string)} · Week {item.weekNumber}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Programs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Programs</CardTitle>
            <Link href="/coach/programs" className="text-xs text-blue-400 hover:text-blue-300">View all</Link>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {(programs ?? []).length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-zinc-500">
                No programs yet. <Link href="/coach/programs" className="text-blue-400 hover:text-blue-300">Create one</Link>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {(programs ?? []).slice(0, 6).map((p: any) => (
                  <Link
                    key={p.id}
                    href={`/coach/programs/${p.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <BookOpen className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-sm text-white truncate">{p.title}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
