// Main lifts that scale with each athlete's 1-rep max.

export type LiftKey = 'squat' | 'trap_bar_dl' | 'db_bench' | 'pendlay_row'

export const LIFTS: { key: LiftKey; label: string; hint?: string }[] = [
  { key: 'squat', label: 'Back Squat' },
  { key: 'trap_bar_dl', label: 'Trap Bar Deadlift' },
  { key: 'db_bench', label: 'DB Bench Press', hint: 'both dumbbells combined' },
  { key: 'pendlay_row', label: 'Pendlay Row' },
]

export const LIFT_LABEL: Record<LiftKey, string> = {
  squat: 'Squat',
  trap_bar_dl: 'Trap Bar DL',
  db_bench: 'DB Bench',
  pendlay_row: 'Pendlay Row',
}

export type RefMaxes = Partial<Record<LiftKey, number>>

/** Which main lift an exercise (Excel name) scales with, if any */
export function liftForExercise(name: string): LiftKey | null {
  const n = name.toLowerCase()
  if (/split|bulgarian|rfess|goblet|spanish|\bsl\b|single/.test(n)) return null
  if (/back squat|pause squat|jump squat/.test(n)) return 'squat'
  if (/trap bar (dl|deadlift)/.test(n)) return 'trap_bar_dl'
  if (/\bsa\b|single arm/.test(n)) return null
  if (/(db|dumbbell).*(bench|floor press|incline press)|incline db (bench|press)/.test(n)) return 'db_bench'
  if (/pendlay row/.test(n)) return 'pendlay_row'
  return null
}

/** Read "Squat 290lb · TB DL 315lb · DB Bench 170lb · Row 150lb" style text */
export function parseRefMaxes(text: string): RefMaxes {
  const out: RefMaxes = {}
  const grab = (re: RegExp) => {
    const m = text.match(re)
    return m ? Number(m[1]) : undefined
  }
  const squat = grab(/squat\s*~?\s*(\d+(?:\.\d+)?)/i)
  const tb = grab(/(?:tb|trap bar)\s*(?:dl|deadlift)\s*~?\s*(\d+(?:\.\d+)?)/i)
  const bench = grab(/bench\s*~?\s*(\d+(?:\.\d+)?)/i)
  const row = grab(/row\s*~?\s*(\d+(?:\.\d+)?)/i)
  if (squat) out.squat = squat
  if (tb) out.trap_bar_dl = tb
  if (bench) out.db_bench = bench
  if (row) out.pendlay_row = row
  return out
}

function round5(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5)
}

/** Scale every "210lb" / "55lb/DB" number in a load by ratio, rounded to 5 lb */
export function scaleLoad(load: string | null, ratio: number): string | null {
  if (!load || !isFinite(ratio) || ratio <= 0 || Math.abs(ratio - 1) < 0.001) return load
  return load.replace(/(\d+(?:\.\d+)?)(\s*lbs?)/gi, (_, num: string, unit: string) => `${round5(Number(num) * ratio)}${unit}`)
}
