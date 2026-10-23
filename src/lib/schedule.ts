import { fetchAll, chunk } from './fetchAll'
// src/lib/schedule.ts
// Week-based scheduling for assigned programs.
//
// - Weeks run Monday -> Sunday.
// - Week 1 is the Monday-Sunday week that contains the assignment's start date.
// - Every workout gets a suggested ("planned") day spread across Mon-Fri of its week.
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

/** The Monday on or before a date */
export function startOfWeek(iso: string): string {
  const dow = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7 // Mon = 0
  return addDays(iso, -dow)
}

/** Suggested day offset (0 = Monday) for workout k of n in a week */
function suggestedOffset(k: number, n: number): number {
  if (n <= 1) return 0 // Monday
  if (n <= 5) return Math.round((k * 4) / (n - 1)) // spread Mon-Fri (4 -> Mon, Tue, Thu, Fri)
  return Math.min(6, Math.round((k * 6) / (n - 1))) // 6-7 workouts: use the whole week
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any

const PROGRAM_TREE = 'id, title, training_blocks(id, week_number, order, workouts(id, title, day_of_week, workout_exercises(id)))'

/** Turn one athlete's assignments, logged results and moved dates into their schedule */
function buildSchedule(
  today: string,
  assignmentRows: Row[],
  programsById: Map<string, Row>,
  results: Row[],
  overrideRows: Row[]
): AthleteSchedule {
  // Exercise completion: workout_exercise_id -> latest completed timestamp
  const completedAt = new Map<string, string>()
  for (const r of results) {
    if (r.completed && r.workout_exercise_id) {
      const prev = completedAt.get(r.workout_exercise_id)
      if (!prev || r.logged_at > prev) completedAt.set(r.workout_exercise_id, r.logged_at)
    }
  }

  // Per-athlete date overrides (table may not exist yet -> ignore errors)
  const overrides = new Map<string, string>()
  for (const o of overrideRows) overrides.set(o.workout_id, o.scheduled_date)

  const assignments: AssignmentInfo[] = []
  const items: ScheduledWorkout[] = []

  for (const a of assignmentRows) {
    const program = programsById.get(a.program_id)
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
      const weekStart = addDays(startOfWeek(startDate), (wn - 1) * 7)
      const weekEnd = addDays(weekStart, 6)
      const n = workouts.length

      workouts.forEach((w, k) => {
        const defaultDate = addDays(weekStart, suggestedOffset(k, n))
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

/** Load everything needed to build an athlete's schedule (works for the athlete and their coach) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAthleteSchedule(supabase: any, athleteId: string): Promise<AthleteSchedule> {
  const map = await getTeamSchedules(supabase, [athleteId])
  return map.get(athleteId) ?? { today: todayISO(), assignments: [], items: [] }
}

/**
 * Schedules for many athletes in a few requests (instead of a few requests per athlete).
 * Returns athleteId -> schedule.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getTeamSchedules(supabase: any, athleteIds: string[]): Promise<Map<string, AthleteSchedule>> {
  const today = todayISO()
  const out = new Map<string, AthleteSchedule>()
  const ids = Array.from(new Set(athleteIds.filter(Boolean)))
  if (ids.length === 0) return out

  const assignments: Row[] = []
  const results: Row[] = []
  const overrides: Row[] = []
  for (const part of chunk(ids, 100)) {
    const [a, r, o] = await Promise.all([
      fetchAll<Row>((from, to) =>
        supabase.from('program_assignments').select('id, athlete_id, program_id, assigned_at, start_date').in('athlete_id', part).range(from, to)),
      fetchAll<Row>((from, to) =>
        supabase.from('workout_results').select('athlete_id, workout_id, workout_exercise_id, completed, logged_at').in('athlete_id', part).order('logged_at').range(from, to)),
      fetchAll<Row>((from, to) =>
        supabase.from('workout_schedule').select('athlete_id, workout_id, scheduled_date').in('athlete_id', part).range(from, to)),
    ])
    assignments.push(...a.data)
    results.push(...r.data)
    if (!o.error) overrides.push(...o.data) // table may not exist yet
  }

  // Each program's weeks/days once, shared by everyone on it
  const programsById = new Map<string, Row>()
  const programIds = Array.from(new Set(assignments.map(a => a.program_id).filter(Boolean)))
  for (const part of chunk(programIds, 20)) {
    const { data } = await supabase.from('programs').select(PROGRAM_TREE).in('id', part)
    for (const p of (data ?? []) as Row[]) programsById.set(p.id, p)
  }

  const group = (rows: Row[]) => {
    const m = new Map<string, Row[]>()
    for (const r of rows) { const l = m.get(r.athlete_id) ?? []; l.push(r); m.set(r.athlete_id, l) }
    return m
  }
  const aBy = group(assignments), rBy = group(results), oBy = group(overrides)
  for (const id of ids) {
    out.set(id, buildSchedule(today, aBy.get(id) ?? [], programsById, rBy.get(id) ?? [], oBy.get(id) ?? []))
  }
  return out
}

/** The date a workout shows on in the calendar */
export function calendarDate(item: ScheduledWorkout): string {
  return item.status === 'done' && item.completedDate ? item.completedDate : item.plannedDate
}
