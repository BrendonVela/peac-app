// Second Excel layout: one tab per training day (e.g. "Mon - Lower"), weeks side by side left to right,
// each week has a "Sets x Reps" column ("4 x 10", "3 x 12/leg", "2 x 20 yd"). Example: Liz Lindke Phase 3.
import * as XLSX from 'xlsx'
import type { ParsedDay, ParsedExercise, ParsedSet, ParsedWeek } from './parseExcelProgram'

const SETS_HEADER = /^sets?\s*[x×]\s*reps?$/i
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

/** "4 x 10/side" -> 4 sets of "10/side"; "Rest 30s" style or blank -> null */
function parsePresc(text: string): { sets: number; reps: string } | null {
  const t = text.trim()
  if (!t) return null
  const m = t.match(/^(\d+)\s*[x×]\s*(.+)$/i)
  if (m) return { sets: Math.min(20, parseInt(m[1], 10)), reps: m[2].trim() }
  return { sets: 1, reps: t }
}

export function parseExcelAcross(workbook: XLSX.WorkBook): ParsedWeek[] {
  type DayWeek = { exercises: ParsedExercise[]; warmup: string[] }
  type Col = { col: number; label: number | null }
  const days: { title: string; perWeek: DayWeek[] }[] = []
  let weekLabels: (number | null)[] = []
  let phaseTitle = ''

  for (const sheetName of workbook.SheetNames) {
    const rows: unknown[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' })

    // Header row: has an "Exercise" column and 2+ "Sets x Reps" columns
    let h = -1
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const r = rows[i].map(str)
      if (r.some(c => /^exercise$/i.test(c)) && r.filter(c => SETS_HEADER.test(c)).length >= 2) { h = i; break }
    }
    if (h < 0) continue
    const header = rows[h].map(str)
    const exCol = header.findIndex(c => /^exercise$/i.test(c))
    const noteCol = header.reduce((acc, c, i) => (/note|cue/i.test(c) ? i : acc), -1)

    // Week number for each "Sets x Reps" column, from a "WEEK 9 ..." label at or left of it in the rows above
    const cols: Col[] = []
    header.forEach((c, i) => { if (SETS_HEADER.test(c)) cols.push({ col: i, label: null }) })
    for (let r = Math.max(0, h - 3); r < h; r++) {
      const row = rows[r].map(str)
      for (const c of cols) {
        for (let k = c.col; k >= 0; k--) {
          const m = row[k]?.match(/\bWEEK\s*(\d+)/i)
          if (m) { if (c.label == null) c.label = parseInt(m[1], 10); break }
          if (row[k] && k < c.col) break
        }
      }
      const ph = row.find(x => /^PHASE\s*\d+/i.test(x))
      if (ph && !phaseTitle) phaseTitle = ph.split('|')[0].trim().replace(/\b\w+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())
    }
    if (!weekLabels.length) weekLabels = cols.map(c => c.label)

    const perWeek: DayWeek[] = cols.map(() => ({ exercises: [], warmup: [] }))
    let section: string | null = null
    for (let i = h + 1; i < rows.length; i++) {
      const row = rows[i].map(str)
      const filled = row.filter(Boolean)
      if (!filled.length) continue
      if (/^SESSION NOTES/i.test(row[0])) break
      const name = row[exCol]
      const hasPresc = cols.some(c => row[c.col])
      if (!name || !hasPresc) {
        // A heading row like "STRENGTH  (20 MIN)" (one cell of text)
        if (filled.length === 1 && filled[0].length < 60) section = filled[0].replace(/\s{2,}/g, ' ')
        continue
      }
      // "A1. Heels-Elevated Front Squat" -> superset A, name without the label
      const lab = name.match(/^([A-Z])(\d+)[a-z]?[.):]\s*(.+)$/)
      const clean = (lab ? lab[3] : name).trim()
      const exSection = lab && section ? `${section} · Superset ${lab[1]}` : section
      const note = noteCol >= 0 ? row[noteCol] || null : null
      const warm = !!section && /WARM[\s-]?UP|PREP/i.test(section)
      cols.forEach((c, w) => {
        const p = parsePresc(row[c.col])
        if (!p) return
        if (warm) { perWeek[w].warmup.push(`${clean} — ${row[c.col]}`); return }
        const sets: ParsedSet[] = Array.from({ length: p.sets }, (_, s) => ({ setLabel: `S${s + 1}`, prescWt: null, prescReps: p.reps }))
        perWeek[w].exercises.push({ name: clean, section: exSection, coachingNote: note, sets })
      })
    }
    if (perWeek.some(w => w.exercises.length)) days.push({ title: sheetName.trim(), perWeek })
  }

  if (!days.length) return []
  const nWeeks = Math.max(...days.map(d => d.perWeek.length))
  const weeks: ParsedWeek[] = []
  for (let w = 0; w < nWeeks; w++) {
    const wdays: ParsedDay[] = days
      .filter(d => d.perWeek[w]?.exercises.length)
      .map(d => ({
        title: d.title,
        warmup: d.perWeek[w].warmup.length ? { title: 'Warm-up', items: d.perWeek[w].warmup } : null,
        exercises: d.perWeek[w].exercises,
      }))
    weeks.push({ phaseTitle: phaseTitle || 'Program', refMaxes: {}, localWeek: weekLabels[w] ?? w + 1, absoluteWeek: w + 1, days: wdays })
  }
  return weeks
}
