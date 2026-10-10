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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSetTargets(wx: any): SetTarget[] {
  if (Array.isArray(wx?.set_targets) && wx.set_targets.length > 0) {
    return wx.set_targets.map((t: any, i: number) => ({
      label: t?.label || `Set ${i + 1}`,
      weight: t?.weight ?? null,
      reps: formatReps(t?.reps),
    }))
  }
  const n = Math.min(20, Math.max(1, parseInt(String(wx?.sets ?? '1'), 10) || 1))
  return Array.from({ length: n }, (_, i) => ({
    label: `Set ${i + 1}`,
    weight: wx?.load ?? null,
    reps: formatReps(wx?.reps),
  }))
}

/** True when every set has the same target */
export function targetsAreUniform(targets: SetTarget[]): boolean {
  return targets.every(t => t.weight === targets[0]?.weight && t.reps === targets[0]?.reps)
}
