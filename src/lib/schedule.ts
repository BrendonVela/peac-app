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

export interface PhaseInfo {
  label: string      // "Phase 5"
  firstWeek: number  // program week numbers this phase covers
  lastWeek: number
}

export interface AssignmentInfo {
  id: string
  programId: string
  programTitle: string
  startDate: string                    // date the start week begins
  totalWeeks: number
  startWeek: number                    // 1 = from the beginning; 17 = start at week 17 (earlier weeks skipped)
  phaseStarts: Record<string, string>  // week number -> date that week starts (later phases)
  phases: PhaseInfo[]
  /** What the athlete can see: 'all', 'ahead' (this week + visibleWeeks-1), 'through' (up to week visibleWeeks) */
  visibility: 'all' | 'ahead' | 'through'
  visibleWeeks: number
  /** Last program week the athlete can see right now (null = everything) */
  visibleThrough: number | null
  /** The program week the athlete is on today (null = hasn't started / finished) */
  currentWeek: number | null
}

/** Last week the athlete can see (same rule as the database's assignment_visible_through) */
export function visibleThroughWeek(
  visibility: string | null | undefined, visibleWeeks: number, startWeek: number, startDate: string,
  phaseStarts: Record<string, string>, today: string
): number | null {
  const v = visibility ?? 'all'
  if (v === 'all') return null
  if (v === 'through') return Math.max(1, visibleWeeks)
  let cur = startWeek
  for (let wn = startWeek; wn <= startWeek + 520; wn++) {
    if (weekStartFor(wn, startWeek, startDate, phaseStarts) > today) break
    cur = wn
  }
  return cur + Math.max(1, visibleWeeks) - 1
}

/** "Phase 5 — Week 2" -> "Phase 5" (falls back to the whole title) */
export function phaseLabel(blockTitle: string | null | undefined, week: number): string {
  const t = String(blockTitle ?? '').trim()
  const m = t.match(/^(.*?)\s*[—–-]\s*Week\s*\d+\s*$/i)
  return (m ? m[1] : t).trim() || `Week ${week}`
}

/** Group a program's weeks into phases by block title */
export function programPhases(blocks: { title?: string | null; week_number?: number | null }[]): PhaseInfo[] {
  const byWeek = new Map<number, string>()
  for (const b of blocks) {
    const wn = Math.max(1, Number(b.week_number) || 1)
    if (!byWeek.has(wn)) byWeek.set(wn, phaseLabel(b.title, wn))
  }
  const phases: PhaseInfo[] = []
  for (const wn of Array.from(byWeek.keys()).sort((a, b) => a - b)) {
    const label = byWeek.get(wn)!
    const last = phases[phases.length - 1]
    if (last && last.label === label && wn === last.lastWeek + 1) last.lastWeek = wn
    else phases.push({ label, firstWeek: wn, lastWeek: wn })
  }
  return phases
}

/** Monday that program week `wn` starts on, given where the athlete started and any phase dates */
export function weekStartFor(wn: number, startWeek: number, startDate: string, phaseStarts: Record<string, string>): string {
  let aw = startWeek, ad = startDate
  for (const [k, d] of Object.entries(phaseStarts ?? {})) {
    const w = Number(k)
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !(w > startWeek) || w > wn) continue
    if (w > aw) { aw = w; ad = d }
  }
  return addDays(startOfWeek(ad), (wn - aw) * 7)
}

export interface AthleteSchedule {
  today: string
  assignments: AssignmentInfo[]
  items: ScheduledWorkout[]
  /** Date (team timezone) of the most recent set/exercise the athlete logged, finished or not */
  lastLogged: string | null
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


/** Turn one athlete's assignments, logged results and moved dates into their schedule */
function buildSchedule(
  today: string,
  assignmentRows: Row[],
  programsById: Map<string, Row>,
  results: Row[],
  overrideRows: Row[],
  athleteView = false,
  // From the fast database function: workout id -> exercises done + when the last one was done
  stats?: Map<string, { d: number; t: string | null }>,
  lastLoggedAt?: string | null
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

    const allWeeks = Array.from(byWeek.keys()).sort((x, y) => x - y)
    const totalWeeks = allWeeks.length > 0 ? allWeeks[allWeeks.length - 1] : 0
    const startWeek = Math.max(1, Number(a.start_week) || 1)
    const phaseStarts: Record<string, string> = (a.phase_starts && typeof a.phase_starts === 'object') ? a.phase_starts : {}
    const visibility = (a.visibility === 'ahead' || a.visibility === 'through') ? a.visibility : 'all'
    const visibleWeeks = Math.max(1, Number(a.visible_weeks) || 1)
    const visibleThrough = visibleThroughWeek(visibility, visibleWeeks, startWeek, startDate, phaseStarts, today)
    let currentWeek: number | null = null
    for (const wn of allWeeks) if (wn >= startWeek && weekStartFor(wn, startWeek, startDate, phaseStarts) <= today) currentWeek = wn
    // Weeks before where the athlete started are skipped (not shown, not "missed").
    // Athlete screens also skip weeks the coach is keeping hidden.
    const weekNumbers = allWeeks.filter(wn => wn >= startWeek && (!athleteView || visibleThrough === null || wn <= visibleThrough))

    assignments.push({
      id: a.id,
      programId: program.id,
      programTitle: program.title,
      startDate,
      totalWeeks,
      startWeek,
      phaseStarts,
      phases: programPhases(program.training_blocks ?? []),
      visibility, visibleWeeks, visibleThrough, currentWeek,
    })

    weekNumbers.forEach(wn => {
      const workouts = (byWeek.get(wn) ?? []).sort(
        (x, y) =>
          (x._blockOrder - y._blockOrder) ||
          ((x.day_of_week ?? 0) - (y.day_of_week ?? 0)) ||
          String(x.title).localeCompare(String(y.title))
      )
      const weekStart = weekStartFor(wn, startWeek, startDate, phaseStarts)
      const weekEnd = addDays(weekStart, 6)
      const n = workouts.length

      workouts.forEach((w, k) => {
        const defaultDate = addDays(weekStart, suggestedOffset(k, n))
        const override = overrides.get(w.id)

        let exerciseCount: number
        let doneCount: number
        let lastDone: string | null = null
        if (typeof w.n === 'number') {
          const st = stats?.get(w.id)
          exerciseCount = w.n
          doneCount = Math.min(st?.d ?? 0, exerciseCount)
          lastDone = st?.t ?? null
        } else {
          const wxIds: string[] = ((w.workout_exercises ?? []) as any[]).map(x => x.id)
          const doneStamps = wxIds.map(id => completedAt.get(id)).filter((s): s is string => !!s)
          exerciseCount = wxIds.length
          doneCount = doneStamps.length
          lastDone = doneStamps.sort()[doneStamps.length - 1] ?? null
        }

        let status: WorkoutStatus
        let completedDate: string | null = null
        if (exerciseCount > 0 && doneCount === exerciseCount) {
          status = 'done'
          completedDate = lastDone ? toLocalISO(lastDone) : null
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
          totalWeeks: athleteView && visibility !== 'all' ? 0 : totalWeeks,
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

  let lastStamp: string | null = lastLoggedAt ?? null
  for (const r of results) if (r.logged_at && (!lastStamp || r.logged_at > lastStamp)) lastStamp = r.logged_at
  return { today, assignments, items, lastLogged: lastStamp ? toLocalISO(lastStamp) : null }
}

/**
 * Programs with their weeks, days and exercise ids, in the shape buildSchedule expects.
 * Loaded as plain lists, a page at a time. (Asking for whole programs nested in one request
 * timed out on long 12-month plans, and those athletes showed "No program assigned".)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadProgramTrees(supabase: any, programIds: string[]): Promise<Map<string, Row>> {
  const out = new Map<string, Row>()
  if (programIds.length === 0) return out

  const perProgram = async (pid: string) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const [p, b, w, x] = await Promise.all([
        supabase.from('programs').select('id, title').eq('id', pid).maybeSingle(),
        fetchAll<Row>((f, t) => supabase.from('training_blocks').select('id, title, week_number, order')
          .eq('program_id', pid).order('id').range(f, t)),
        fetchAll<Row>((f, t) => supabase.from('workouts').select('id, block_id, title, day_of_week')
          .eq('program_id', pid).order('id').range(f, t)),
        fetchAll<Row>((f, t) => supabase.from('workout_exercises').select('id, workout_id, workouts!inner(program_id)')
          .eq('workouts.program_id', pid).order('id').range(f, t)),
      ])
      const err = p.error || b.error || w.error || x.error
      if (err) {
        console.error('Loading program for schedule failed', pid, err.message)
        continue
      }
      if (!p.data) return
      const exByWorkout = new Map<string, Row[]>()
      for (const r of x.data) { const l = exByWorkout.get(r.workout_id) ?? []; l.push({ id: r.id }); exByWorkout.set(r.workout_id, l) }
      const wByBlock = new Map<string, Row[]>()
      for (const r of w.data) {
        if (!r.block_id) continue
        const l = wByBlock.get(r.block_id) ?? []
        l.push({ id: r.id, title: r.title, day_of_week: r.day_of_week, workout_exercises: exByWorkout.get(r.id) ?? [] })
        wByBlock.set(r.block_id, l)
      }
      out.set(pid, {
        id: p.data.id,
        title: p.data.title,
        training_blocks: b.data.map(bl => ({ ...bl, workouts: wByBlock.get(bl.id) ?? [] })),
      })
      return
    }
  }
  for (const part of chunk(programIds, 8)) await Promise.all(part.map(perProgram))
  return out
}

/** Everything for many athletes' schedules in ONE request. Returns null if the database function isn't installed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadViaDatabase(supabase: any, ids: string[], today: string, athleteView: boolean): Promise<Map<string, AthleteSchedule> | null> {
  const parts = chunk(ids, 200)
  const replies = await Promise.all(parts.map(part => supabase.rpc('get_schedule_data', { p_athlete_ids: part })))
  if (replies.some((r: any) => r.error || !r.data)) {
    const err = replies.find((r: any) => r.error)?.error
    if (err) console.error('get_schedule_data failed, using the slower way', err.message)
    return null
  }
  const assignments: Row[] = [], overrides: Row[] = [], programs: Row[] = [], stats: Row[] = [], last: Row[] = []
  for (const r of replies as any[]) {
    assignments.push(...(r.data.assignments ?? []))
    overrides.push(...(r.data.overrides ?? []))
    programs.push(...(r.data.programs ?? []))
    stats.push(...(r.data.stats ?? []))
    last.push(...(r.data.last ?? []))
  }
  // Rebuild each program as weeks -> days, the shape buildSchedule reads
  const programsById = new Map<string, Row>()
  for (const p of programs) {
    if (programsById.has(p.id)) continue
    const byBlock = new Map<string, Row[]>()
    for (const w of (p.workouts ?? []) as Row[]) {
      const l = byBlock.get(w.block_id) ?? []
      l.push(w)
      byBlock.set(w.block_id, l)
    }
    programsById.set(p.id, {
      id: p.id,
      title: p.title,
      training_blocks: ((p.blocks ?? []) as Row[]).map(b => ({ ...b, workouts: byBlock.get(b.id) ?? [] })),
    })
  }
  const statsBy = new Map<string, Map<string, { d: number; t: string | null }>>()
  for (const s of stats) {
    const m = statsBy.get(s.a) ?? new Map()
    m.set(s.w, { d: Number(s.d) || 0, t: s.t ?? null })
    statsBy.set(s.a, m)
  }
  const lastBy = new Map<string, string>(last.map(l => [l.a, l.t]))
  const group = (rows: Row[]) => {
    const m = new Map<string, Row[]>()
    for (const r of rows) { const l = m.get(r.athlete_id) ?? []; l.push(r); m.set(r.athlete_id, l) }
    return m
  }
  const aBy = group(assignments), oBy = group(overrides)
  const out = new Map<string, AthleteSchedule>()
  for (const id of ids) {
    out.set(id, buildSchedule(today, aBy.get(id) ?? [], programsById, [], oBy.get(id) ?? [], athleteView, statsBy.get(id), lastBy.get(id) ?? null))
  }
  return out
}

/** Load everything needed to build an athlete's schedule (works for the athlete and their coach) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAthleteSchedule(supabase: any, athleteId: string, opts: { athleteView?: boolean } = {}): Promise<AthleteSchedule> {
  const map = await getTeamSchedules(supabase, [athleteId], opts)
  return map.get(athleteId) ?? { today: todayISO(), assignments: [], items: [], lastLogged: null }
}

/**
 * Schedules for many athletes in a few requests (instead of a few requests per athlete).
 * Returns athleteId -> schedule.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getTeamSchedules(supabase: any, athleteIds: string[], opts: { athleteView?: boolean } = {}): Promise<Map<string, AthleteSchedule>> {
  const today = todayISO()
  const out = new Map<string, AthleteSchedule>()
  const ids = Array.from(new Set(athleteIds.filter(Boolean)))
  if (ids.length === 0) return out

  // Fast path: one database call does the heavy lifting (supabase/speed.sql)
  const fast = await loadViaDatabase(supabase, ids, today, !!opts.athleteView)
  if (fast) return fast

  const assignments: Row[] = []
  const results: Row[] = []
  const overrides: Row[] = []
  for (const part of chunk(ids, 100)) {
    const [a0, r, o] = await Promise.all([
      fetchAll<Row>((from, to) =>
        supabase.from('program_assignments').select('*').in('athlete_id', part).range(from, to)),
      fetchAll<Row>((from, to) =>
        supabase.from('workout_results').select('athlete_id, workout_id, workout_exercise_id, completed, logged_at').in('athlete_id', part).order('logged_at').order('id').range(from, to)),
      fetchAll<Row>((from, to) =>
        supabase.from('workout_schedule').select('athlete_id, workout_id, scheduled_date').in('athlete_id', part).range(from, to)),
    ])
    // Older database without the phase-date columns yet -> load without them
    const a = a0.error
      ? await fetchAll<Row>((from, to) =>
          supabase.from('program_assignments').select('id, athlete_id, program_id, assigned_at, start_date').in('athlete_id', part).range(from, to))
      : a0
    assignments.push(...a.data)
    results.push(...r.data)
    if (!o.error) overrides.push(...o.data) // table may not exist yet
  }

  // Each program's weeks/days once, shared by everyone on it
  const programIds = Array.from(new Set(assignments.map(a => a.program_id).filter(Boolean)))
  const programsById = await loadProgramTrees(supabase, programIds)

  const group = (rows: Row[]) => {
    const m = new Map<string, Row[]>()
    for (const r of rows) { const l = m.get(r.athlete_id) ?? []; l.push(r); m.set(r.athlete_id, l) }
    return m
  }
  const aBy = group(assignments), rBy = group(results), oBy = group(overrides)
  for (const id of ids) {
    out.set(id, buildSchedule(today, aBy.get(id) ?? [], programsById, rBy.get(id) ?? [], oBy.get(id) ?? [], !!opts.athleteView))
  }
  return out
}

/** The date a workout shows on in the calendar */
export function calendarDate(item: ScheduledWorkout): string {
  return item.status === 'done' && item.completedDate ? item.completedDate : item.plannedDate
}
