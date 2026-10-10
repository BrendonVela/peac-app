import { scaleLoad, type LiftKey } from './maxes'

export type AthleteMaxes = Partial<Record<LiftKey, number>>

// Per-set targets for a workout exercise.
// Uses set_targets when the program has different targets per set,
// otherwise repeats the exercise's load/reps for each set.

export interface SetTarget {
  label: string
  weight: string | null
  reps: string | null
}

/** "8" -> "8 reps", but "8 reps" or "20yd" stays as-is */
export function formatReps(reps: string | null | undefined): string | null {
  if (reps == null || String(reps).trim() === '') return null
  const r = String(reps).trim()
  return /^\d+$/.test(r) ? `${r} reps` : r
}

/**
 * How much to scale this exercise's weights for an athlete:
 * athlete's max / the max the program was written for. 1 = unchanged.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function maxRatio(wx: any, maxes?: AthleteMaxes | null): number {
  const lift = wx?.max_lift as LiftKey | null
  const ref = Number(wx?.ref_max)
  const mine = lift && maxes ? maxes[lift] : undefined
  if (!lift || !ref || !mine) return 1
  return mine / ref
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSetTargets(wx: any, maxes?: AthleteMaxes | null): SetTarget[] {
  const ratio = maxRatio(wx, maxes)
  if (Array.isArray(wx?.set_targets) && wx.set_targets.length > 0) {
    return wx.set_targets.map((t: any, i: number) => ({
      label: t?.label || `Set ${i + 1}`,
      weight: scaleLoad(t?.weight ?? null, ratio),
      reps: formatReps(t?.reps),
    }))
  }
  const n = Math.min(20, Math.max(1, parseInt(String(wx?.sets ?? '1'), 10) || 1))
  const weight = scaleLoad(wx?.load ?? null, ratio)
  return Array.from({ length: n }, (_, i) => ({
    label: `Set ${i + 1}`,
    weight,
    reps: formatReps(wx?.reps),
  }))
}

/** True when every set has the same target */
export function targetsAreUniform(targets: SetTarget[]): boolean {
  return targets.every(t => t.weight === targets[0]?.weight && t.reps === targets[0]?.reps)
}
