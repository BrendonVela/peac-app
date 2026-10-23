// Team leaderboards: best lifts (estimated or saved max) and best test results per athlete.
// Uses the admin (service-role) client, so callers MUST decide which coach's team to show.

import { LIFTS, liftForExercise, type LiftKey } from './maxes'
import { estimateMax } from './liftHistory'
import { TEST_META } from './utils'
import { toLocalISO } from './schedule'
import type { TestType } from '@/types'

export type MetricKey = LiftKey | Exclude<TestType, 'body_weight'>

export interface BoardRow {
  athleteId: string
  name: string
  value: number
  date: string | null
  /** For lifts: "est." when it came from logged sets, "max" when the coach entered it */
  source?: 'est' | 'max' | 'test'
}

export interface Metric {
  key: MetricKey
  label: string
  unit: string
  higherIsBetter: boolean
  kind: 'lift' | 'test'
  rows: BoardRow[]
}

const TEST_KEYS: Exclude<TestType, 'body_weight'>[] = ['10_yard', '20_yard', '40_yard', 'vertical_jump', 'broad_jump', 'pro_agility']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getTeamBoard(admin: any, coachId: string) {
  const { data: athletes } = await admin.from('athletes').select('id, name').eq('coach_id', coachId).order('name')
  const list = (athletes ?? []) as { id: string; name: string }[]
  const ids = list.map(a => a.id)
  const nameOf = new Map(list.map(a => [a.id, a.name]))
  if (ids.length === 0) return { athletes: list, metrics: [] as Metric[] }

  const [{ data: maxRows }, { data: tests }, { data: results }] = await Promise.all([
    admin.from('athlete_maxes').select('athlete_id, lift, value, updated_at').in('athlete_id', ids),
    admin.from('performance_tests').select('athlete_id, test_type, result, date').in('athlete_id', ids),
    admin
      .from('workout_results')
      .select('athlete_id, set_logs, weight_used, reps_completed, logged_at, workout_exercises(max_lift, exercises(title))')
      .in('athlete_id', ids)
      .order('logged_at', { ascending: false })
      .limit(5000),
  ])

  // athlete -> lift -> best
  const best = new Map<string, Map<LiftKey, BoardRow>>()
  const consider = (athleteId: string, lift: LiftKey, row: Omit<BoardRow, 'athleteId' | 'name'>) => {
    const m = best.get(athleteId) ?? new Map<LiftKey, BoardRow>()
    const prev = m.get(lift)
    if (!prev || row.value > prev.value) m.set(lift, { athleteId, name: nameOf.get(athleteId) ?? 'Athlete', ...row })
    best.set(athleteId, m)
  }

  for (const r of (results ?? []) as any[]) {
    const wx = r.workout_exercises
    const lift: LiftKey | null = (wx?.max_lift as LiftKey) ?? liftForExercise(wx?.exercises?.title ?? '')
    if (!lift) continue
    const sets: { weight: number; reps: number }[] = Array.isArray(r.set_logs)
      ? r.set_logs
          .filter((l: any) => l && Number(l.weight) > 0 && Number(l.reps) > 0)
          .map((l: any) => ({ weight: Number(l.weight), reps: Number(l.reps) }))
      : []
    if (sets.length === 0 && Number(r.weight_used) > 0 && Number(r.reps_completed) > 0) {
      sets.push({ weight: Number(r.weight_used), reps: Number(r.reps_completed) })
    }
    for (const s of sets) {
      consider(r.athlete_id, lift, { value: estimateMax(s.weight, s.reps), date: toLocalISO(r.logged_at), source: 'est' })
    }
  }
  for (const m of (maxRows ?? []) as any[]) {
    const lift = m.lift as LiftKey
    const raw = Number(m.value)
    if (!(raw > 0)) continue
    // DB bench max is stored for both dumbbells; logged sets are per dumbbell
    const v = lift === 'db_bench' ? Math.round(raw / 2) : raw
    consider(m.athlete_id, lift, { value: v, date: m.updated_at ? toLocalISO(m.updated_at) : null, source: 'max' })
  }

  const metrics: Metric[] = []
  for (const { key, label } of LIFTS) {
    const rows: BoardRow[] = []
    best.forEach(m => { const r = m.get(key); if (r) rows.push(r) })
    rows.sort((a, b) => b.value - a.value)
    metrics.push({ key, label: key === 'db_bench' ? `${label} (per DB)` : label, unit: 'lb', higherIsBetter: true, kind: 'lift', rows })
  }

  for (const t of TEST_KEYS) {
    const meta = TEST_META[t]
    const bestByAthlete = new Map<string, BoardRow>()
    for (const row of (tests ?? []) as any[]) {
      if (row.test_type !== t) continue
      const v = Number(row.result)
      if (!(v > 0)) continue
      const prev = bestByAthlete.get(row.athlete_id)
      const better = !prev || (meta.higherIsBetter ? v > prev.value : v < prev.value)
      if (better) bestByAthlete.set(row.athlete_id, { athleteId: row.athlete_id, name: nameOf.get(row.athlete_id) ?? 'Athlete', value: v, date: row.date, source: 'test' })
    }
    const rows = Array.from(bestByAthlete.values()).sort((a, b) => (meta.higherIsBetter ? b.value - a.value : a.value - b.value))
    metrics.push({ key: t, label: meta.label, unit: meta.unit, higherIsBetter: meta.higherIsBetter, kind: 'test', rows })
  }

  return { athletes: list, metrics }
}
