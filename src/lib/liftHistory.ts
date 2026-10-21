// Main-lift history from logged sets: estimated max per workout, best sets and PRs.

import { toLocalISO } from './schedule'
import { LIFTS, liftForExercise, type LiftKey } from './maxes'

export interface LiftPoint {
  date: string            // YYYY-MM-DD
  e1rm: number            // best estimated 1-rep max that day
  weight: number          // weight of that best set
  reps: number
}

export interface LiftSummary {
  lift: LiftKey
  label: string
  perDumbbell: boolean
  points: LiftPoint[]
  best: LiftPoint | null      // highest estimated max ever
  heaviest: LiftPoint | null  // heaviest single set ever
  latest: LiftPoint | null
  newPR: boolean              // latest workout set the best estimated max
  savedMax: number | null     // the max the coach entered (per DB for bench)
}

/** Epley estimate; reps capped at 12 because estimates get unreliable past that */
export function estimateMax(weight: number, reps: number): number {
  if (reps <= 1) return weight
  return Math.round(weight * (1 + Math.min(reps, 12) / 30))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getLiftHistory(supabase: any, athleteId: string): Promise<LiftSummary[]> {
  const [{ data: results }, { data: maxRows }] = await Promise.all([
    supabase
      .from('workout_results')
      .select('set_logs, weight_used, reps_completed, logged_at, workout_exercises(max_lift, exercises(title))')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: true })
      .limit(2000),
    supabase.from('athlete_maxes').select('lift, value').eq('athlete_id', athleteId),
  ])

  const saved = new Map<string, number>()
  ;(maxRows ?? []).forEach((m: any) => saved.set(m.lift, Number(m.value)))

  // lift -> date -> best point that day
  const byLift = new Map<LiftKey, Map<string, LiftPoint>>()

  for (const r of (results ?? []) as any[]) {
    const wx = r.workout_exercises
    const lift: LiftKey | null = (wx?.max_lift as LiftKey) ?? liftForExercise(wx?.exercises?.title ?? '')
    if (!lift) continue

    let sets: { weight: number; reps: number }[] = []
    if (Array.isArray(r.set_logs)) {
      sets = r.set_logs
        .filter((l: any) => l && l.weight != null && l.reps != null && Number(l.weight) > 0 && Number(l.reps) > 0)
        .map((l: any) => ({ weight: Number(l.weight), reps: Number(l.reps) }))
    }
    if (sets.length === 0 && r.weight_used != null && r.reps_completed != null && r.weight_used > 0 && r.reps_completed > 0) {
      sets = [{ weight: Number(r.weight_used), reps: Number(r.reps_completed) }]
    }
    if (sets.length === 0) continue

    const date = toLocalISO(r.logged_at)
    const dayMap = byLift.get(lift) ?? new Map<string, LiftPoint>()
    for (const s of sets) {
      const e = estimateMax(s.weight, s.reps)
      const prev = dayMap.get(date)
      if (!prev || e > prev.e1rm || (e === prev.e1rm && s.weight > prev.weight)) {
        dayMap.set(date, { date, e1rm: e, weight: s.weight, reps: s.reps })
      }
    }
    byLift.set(lift, dayMap)
  }

  return LIFTS.map(({ key, label }) => {
    const points = Array.from(byLift.get(key)?.values() ?? []).sort((a, b) => a.date.localeCompare(b.date))
    const best = points.reduce<LiftPoint | null>((m, p) => (!m || p.e1rm > m.e1rm ? p : m), null)
    const heaviest = points.reduce<LiftPoint | null>((m, p) => (!m || p.weight > m.weight ? p : m), null)
    const latest = points[points.length - 1] ?? null
    const priorBest = points.slice(0, -1).reduce((m, p) => Math.max(m, p.e1rm), 0)
    const perDumbbell = key === 'db_bench'
    const savedRaw = saved.get(key) ?? null
    return {
      lift: key,
      label,
      perDumbbell,
      points,
      best,
      heaviest,
      latest,
      newPR: points.length > 1 && !!latest && latest.e1rm > priorBest,
      savedMax: savedRaw == null ? null : perDumbbell ? Math.round(savedRaw / 2) : savedRaw,
    }
  })
}
