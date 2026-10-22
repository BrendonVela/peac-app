// Rest times: read from the exercise's rest field or its coaching note ("REST 2-3 min").

export const DEFAULT_REST_SECONDS = 90

export interface RestInfo {
  seconds: number
  /** What the coach wrote, e.g. "2–3 min" (null when using the default) */
  label: string | null
}

function toSeconds(n: number, unit: string): number {
  return /^m/i.test(unit) ? Math.round(n * 60) : Math.round(n)
}

/** Find "REST 3 min", "rest 20 sec", "Rest: 2-3 min" in text */
export function restFromText(text: string | null | undefined): RestInfo | null {
  if (!text) return null
  const m = String(text).match(/rest[:\s]*(\d+(?:\.\d+)?)\s*(?:[-–]|to)?\s*(\d+(?:\.\d+)?)?\s*(min(?:ute)?s?|m\b|sec(?:ond)?s?|s\b)/i)
  if (!m) return null
  const lo = Number(m[1])
  const hi = m[2] ? Number(m[2]) : null
  const unit = m[3]
  const unitLabel = /^m/i.test(unit) ? 'min' : 'sec'
  return {
    seconds: toSeconds(lo, unit),
    label: hi ? `${lo}–${hi} ${unitLabel}` : `${lo} ${unitLabel}`,
  }
}

/** The rest field on its own: "90", "90s", "2 min", "1:30" */
function restFromField(rest: string | null | undefined): RestInfo | null {
  if (!rest) return null
  const r = String(rest).trim()
  const clock = r.match(/^(\d+):(\d{2})$/)
  if (clock) return { seconds: Number(clock[1]) * 60 + Number(clock[2]), label: r }
  const m = r.match(/^(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|m|sec(?:ond)?s?|s)?$/i)
  if (m) return { seconds: toSeconds(Number(m[1]), m[2] ?? 's'), label: r }
  return restFromText(`rest ${r}`)
}

export function restForExercise(wx: { rest?: string | null; notes?: string | null }): RestInfo {
  return restFromField(wx.rest) ?? restFromText(wx.notes) ?? { seconds: DEFAULT_REST_SECONDS, label: null }
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Simple page-wide events so any exercise can start the one timer
export const REST_START_EVENT = 'peac:rest-start'
export const SET_DONE_EVENT = 'peac:set-done'
/** Fired by an exercise logger when the exercise becomes complete / not complete */
export const EXERCISE_DONE_EVENT = 'peac:exercise-done'
export interface ExerciseDoneDetail { id: string; completed: boolean }
export interface RestEventDetail { seconds: number; title: string }
