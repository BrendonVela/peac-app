// src/lib/schedule.ts
// Week-based scheduling for assigned programs.
//
// - Week 1 starts on the assignment's start date (the day the coach assigned it).
// - Each program week is the 7 days that follow.
// - Every workout gets a suggested ("planned") day spread across its week.
//   Coaches and athletes can move it to any date (stored per athlete in workout_schedule).
// - Status: done (all exercises complete), in_progress (some), not_started,
//   missed (its week is over and it isn't done).

// The team's timezone, so "today" matches what athletes see on their phones.
export const APP_TIMEZONE = 'America/Los_Angeles'

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Today's date (YYYY-MM-DD) in the team's timezone */
export function todayISO(): string {
  return dateFmt.format(new Date())
}

/** Convert a timestamp to a YYYY-MM-DD date in the team's timezone */
export function toLocalISO(timestamp: string): string {
  return dateFmt.format(new Date(timestamp))
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** a - b in days */
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000)
}

/** "Tue, Oct 14" */
export function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** "Oct 14" */
export function formatMonthDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  })
}

/** "Tue" */
export function formatWeekday(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' })
}

export type WorkoutStatus = 'done' | 'in_progress' | 'not_started' | 'missed'

export interface ScheduledWorkout {
  workoutId: string
  title: string
  programId: string
  programTitle: string
  weekNumber: number
  totalWeeks: number
  dayNumber: number
  weekStart: string
  weekEnd: string
  plannedDate: string
  isRescheduled: boolean
  completedDate: string | null
  exerciseCount: number
  doneCount: number
  status: WorkoutStatus
}

export interface AssignmentInfo {
  id: string
  programId: string
  programTitle: string
  startDate: string
  totalWeeks: number
}

export interface AthleteSchedule {
  today: string
  assignments: AssignmentInfo[]
  items: ScheduledWorkout[]
}

export const STATUS_LABEL: Record<WorkoutStatus, string> = {
  done: 'Done',
  in_progress: 'In progress',
  not_started: 'Not started',
  missed: 'Missed',
}

export const STATUS_BADGE: Record<WorkoutStatus, 'green' | 'blue' | 'default' | 'red'> = {
  done: 'green',
  in_progress: 'blue',
  not_started: 'default',
  missed: 'red',
}

/** Load everything needed to build an athlete's schedule (works for the athlete and their coach) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAthleteSchedule(supabase: any, athleteId: string): Promise<AthleteSchedule> {
  const today = todayISO()

  const [assignmentsRes, resultsRes, overridesRes] = await Promise.all([
    supabase
      .from('program_assignments')
      .select('id, program_id, assigned_at, start_date, programs(id, title, training_blocks(id, week_number, order, workouts(id, title, day_of_week, workout_exercises(id))))')
      .eq('athlete_id', athleteId),
    supabase
      .from('workout_results')
      .select('workout_id, workout_exercise_id, completed, logged_at')
      .eq('athlete_id', athleteId),
    supabase
      .from('workout_schedule')
      .select('workout_id, scheduled_date')
      .eq('athlete_id', athleteId),
  ])

  // Exercise completion: workout_exercise_id -> latest completed timestamp
  const completedAt = new Map<string, string>()
  for (const r of (resultsRes.data ?? []) as any[]) {
    if (r.completed && r.workout_exercise_id) {
      const prev = completedAt.get(r.workout_exercise_id)
      if (!prev || r.logged_at > prev) completedAt.set(r.workout_exercise_id, r.logged_at)
    }
  }

  // Per-athlete date overrides (table may not exist yet -> ignore errors)
  const overrides = new Map<string, string>()
  if (!overridesRes.error) {
    for (const o of (overridesRes.data ?? []) as any[]) overrides.set(o.workout_id, o.scheduled_date)
  }

  const assignments: AssignmentInfo[] = []
  const items: ScheduledWorkout[] = []

  for (const a of (assignmentsRes.data ?? []) as any[]) {
    const program = a.programs
    if (!program) continue

    const startDate: string = a.start_date ?? (a.assigned_at ? toLocalISO(a.assigned_at) : today)

    // Group workouts by week number
    const byWeek = new Map<number, any[]>()
    for (const block of (program.training_blocks ?? []) as any[]) {
      const wn = Math.max(1, Number(block.week_number) || 1)
      const list = byWeek.get(wn) ?? []
      for (const w of (block.workouts ?? []) as any[]) list.push({ ...w, _blockOrder: block.order ?? 0 })
      byWeek.set(wn, list)
    }

    const weekNumbers = Array.from(byWeek.keys()).sort((x, y) => x - y)
    const totalWeeks = weekNumbers.length > 0 ? weekNumbers[weekNumbers.length - 1] : 0

    assignments.push({
      id: a.id,
      programId: program.id,
      programTitle: program.title,
      startDate,
      totalWeeks,
    })

    weekNumbers.forEach(wn => {
      const workouts = (byWeek.get(wn) ?? []).sort(
        (x, y) =>
          (x._blockOrder - y._blockOrder) ||
          ((x.day_of_week ?? 0) - (y.day_of_week ?? 0)) ||
          String(x.title).localeCompare(String(y.title))
      )
      const weekStart = addDays(startDate, (wn - 1) * 7)
      const weekEnd = addDays(weekStart, 6)
      const n = workouts.length

      workouts.forEach((w, k) => {
        // Spread workouts across the week (4 workouts -> days 0, 2, 4, 5)
        const offset = Math.min(6, Math.round((k * 7) / Math.max(n, 1)))
        const defaultDate = addDays(weekStart, offset)
        const override = overrides.get(w.id)

        const wxIds: string[] = ((w.workout_exercises ?? []) as any[]).map(x => x.id)
        const doneStamps = wxIds.map(id => completedAt.get(id)).filter((s): s is string => !!s)
        const exerciseCount = wxIds.length
        const doneCount = doneStamps.length

        let status: WorkoutStatus
        let completedDate: string | null = null
        if (exerciseCount > 0 && doneCount === exerciseCount) {
          status = 'done'
          completedDate = toLocalISO(doneStamps.sort()[doneStamps.length - 1])
        } else if (doneCount > 0) {
          status = 'in_progress'
        } else if (today > weekEnd) {
          status = 'missed'
        } else {
          status = 'not_started'
        }
        // An in-progress workout from a finished week still counts as missed
        if (status === 'in_progress' && today > weekEnd) status = 'missed'

        items.push({
          workoutId: w.id,
          title: w.title,
          programId: program.id,
          programTitle: program.title,
          weekNumber: wn,
          totalWeeks,
          dayNumber: k + 1,
          weekStart,
          weekEnd,
          plannedDate: override ?? defaultDate,
          isRescheduled: !!override,
          completedDate,
          exerciseCount,
          doneCount,
          status,
        })
      })
    })
  }

  return { today, assignments, items }
}

/** The date a workout shows on in the calendar */
export function calendarDate(item: ScheduledWorkout): string {
  return item.status === 'done' && item.completedDate ? item.completedDate : item.plannedDate
}
