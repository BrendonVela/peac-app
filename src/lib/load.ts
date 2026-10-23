// Training load from session RPE: load = RPE x minutes (Foster's session-RPE method)

import { startOfWeek, addDays, toLocalISO, todayISO } from './schedule'

export interface SessionRow {
  workout_id: string
  rpe: number
  minutes: number | null
  notes: string | null
  completed_at: string
  workouts?: { title: string } | null
}

export interface WeekLoad {
  weekStart: string
  load: number
  sessions: number
  avgRpe: number | null
}

export function sessionLoad(s: { rpe: number; minutes: number | null }): number | null {
  return s.minutes ? s.rpe * s.minutes : null
}

/** Last `weeks` Monday-Sunday weeks, oldest first */
export function weeklyLoad(sessions: SessionRow[], weeks = 6): WeekLoad[] {
  const thisWeek = startOfWeek(todayISO())
  const out: WeekLoad[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(thisWeek, -7 * i)
    const we = addDays(ws, 7)
    const inWeek = sessions.filter(s => {
      const d = toLocalISO(s.completed_at)
      return d >= ws && d < we
    })
    const load = inWeek.reduce((n, s) => n + (sessionLoad(s) ?? 0), 0)
    const avgRpe = inWeek.length ? Math.round((inWeek.reduce((n, s) => n + s.rpe, 0) / inWeek.length) * 10) / 10 : null
    out.push({ weekStart: ws, load, sessions: inWeek.length, avgRpe })
  }
  return out
}

/** This week's load vs the average of the 3 weeks before. >1.5 = big jump */
export function loadRatio(w: WeekLoad[]): number | null {
  if (w.length < 4) return null
  const cur = w[w.length - 1].load
  const prev = w.slice(-4, -1)
  const avg = prev.reduce((n, x) => n + x.load, 0) / prev.length
  if (!avg) return null
  return Math.round((cur / avg) * 100) / 100
}
