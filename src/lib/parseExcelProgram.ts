import * as XLSX from 'xlsx'
import { parseRefMaxes, type RefMaxes } from './maxes'
import { parseExcelAcross } from './parseExcelAcross'

export interface ParsedSet {
  setLabel: string
  prescWt: string | null
  prescReps: string | null
}

export interface ParsedExercise {
  name: string
  section: string | null
  coachingNote: string | null
  sets: ParsedSet[]
}

export interface ParsedWarmup {
  title: string
  items: string[]
}

export interface ParsedDay {
  title: string
  warmup: ParsedWarmup | null
  exercises: ParsedExercise[]
}

/** "DAY 1 — …" or "MON — …" / "Monday - …" starts a new training day */
// "DAY 1 —", "Day A:", "MONDAY -", "DAY 1 (MON) —", "DAY 2 (WEDNESDAY) —", or just "DAY 1"
const DAY_HEADER = /^(?:(DAY\s*(\d+|[A-Z])\b|(MON|TUES?|WED(NES)?|THU(RS?)?|FRI|SAT(UR)?|SUN)(DAY)?)\b\.?(\s*\([^)]{1,30}\))?\s*([—–:-]|$))/i

/** Numbers in the weight column are pounds: 210 -> "210 lb" */
function cellText(v: any): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return `${Math.round(v * 10) / 10} lb`
  return String(v).trim() || null
}

function isWarmupSection(section: string | null): boolean {
  return !!section && /WARM[\s-]?UP/i.test(section)
}

export interface ParsedWeek {
  phaseTitle: string
  /** Maxes the phase's weights were written for (e.g. Squat 290) */
  refMaxes: RefMaxes
  localWeek: number
  absoluteWeek: number
  days: ParsedDay[]
}

export function parseExcelProgram(buffer: ArrayBuffer): ParsedWeek[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const phaseSheets = workbook.SheetNames.filter(name => name !== workbook.SheetNames[0])

  const allWeeks: ParsedWeek[] = []
  let weekCounter = 0
  let lastRefMaxes: RefMaxes = {}

  for (const sheetName of phaseSheets) {
    const sheet = workbook.Sheets[sheetName]
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

    // Reference maxes from the phase header (falls back to the previous phase)
    let refMaxes: RefMaxes = {}
    for (let r = 0; r < Math.min(rows.length, 4); r++) {
      const cell = rows[r]?.[0]
      if (typeof cell === 'string' && /1RM/i.test(cell)) {
        refMaxes = parseRefMaxes(cell)
        break
      }
    }
    refMaxes = { ...lastRefMaxes, ...refMaxes }
    lastRefMaxes = refMaxes

    // Column titles can be in any column and any capitalization ("SET", "Set", "PRESC WT", "Presc. Wt"...)
    const norm = (v: any) => (typeof v === 'string' ? v.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ') : v)
    let headerRowIdx: number | null = null
    for (let i = 0; i < rows.length; i++) {
      if ((rows[i] ?? []).some((c: any) => norm(c) === 'SET')) {
        headerRowIdx = i
        break
      }
    }
    if (headerRowIdx === null) continue

    const header = rows[headerRowIdx]
    const weekBlocks: { week: number; startCol: number }[] = []
    let localWeekNum = 0
    for (let col = 0; col < header.length; col++) {
      if (/^PRESC(RIBED)? (WT|WEIGHT|LOAD)$/.test(String(norm(header[col]) ?? ''))) {
        localWeekNum++
        weekBlocks.push({ week: localWeekNum, startCol: col })
      }
    }
    if (weekBlocks.length === 0) continue
    const setCol = Math.max(0, header.findIndex((c: any) => norm(c) === 'SET'))
    const nameIdx = header.findIndex((c: any) => /^(EXERCISE|EXERCISES|MOVEMENT)$/.test(String(norm(c) ?? '')))
    const nameCol = nameIdx >= 0 ? nameIdx : 1
    const isSetLabel = (v: any) => typeof v === 'string' && /^(SET|SETS|RD|ROUND)\s*\d/i.test(v.trim())

    type RawExercise = {
      name: string
      section: string | null
      coachingNote: string | null
      sets: { setLabel: string; weeks: Record<number, { prescWt: any; prescReps: any }> }[]
    }
    type RawDay = { title: string; warmup: ParsedWarmup | null; exercises: RawExercise[] }
    const rawDays: RawDay[] = []
    let currentDay: RawDay | null = null
    let currentSection: string | null = null
    let i = headerRowIdx + 1

    while (i < rows.length) {
      const row = rows[i]
      const first = row[0]
      const firstTrimmed = typeof first === 'string' ? first.trim() : first

      // A testing/results table after the training days isn't a workout
      if (typeof firstTrimmed === 'string' && /^★?\s*WEEK\s*\d+\s*[—–-]\s*TESTING/i.test(firstTrimmed.replace(/^★\s*/, ''))) {
        currentDay = null
        currentSection = null
        i++
        continue
      }

      if (typeof firstTrimmed === 'string' && DAY_HEADER.test(firstTrimmed)) {
        currentDay = { title: firstTrimmed.replace(/\s+/g, ' '), warmup: null, exercises: [] }
        currentSection = null
        rawDays.push(currentDay)
        i++
        continue
      }

      if (typeof firstTrimmed === 'string' && firstTrimmed.startsWith('▸')) {
        currentSection = firstTrimmed.replace('▸', '').trim()
        if (currentDay && isWarmupSection(currentSection) && !currentDay.warmup) {
          currentDay.warmup = { title: currentSection, items: [] }
        }
        i++
        continue
      }

      // Warm-up lines look like "    1.  Foam Roll: T-Spine — 60 sec each"
      if (
        currentDay?.warmup &&
        isWarmupSection(currentSection) &&
        typeof firstTrimmed === 'string'
      ) {
        const m = firstTrimmed.match(/^\d+\.\s*(.+)$/)
        if (m) {
          currentDay.warmup.items.push(m[1].trim())
          i++
          continue
        }
      }

      // Exercise rows are numbered 1, 2, 3… or A1, A2, B1… (French contrast complexes)
      const isExerciseStart =
        // (some files store the number as text, like "1.0" or "3.5")
        (typeof first === 'number' || (typeof firstTrimmed === 'string' && /^(\d{1,3}(\.\d{1,2})?[a-z]?|[A-Z]\d{1,2}[a-z]?)$/.test(firstTrimmed))) &&
        !!row[nameCol] &&
        isSetLabel(row[setCol])

      if (isExerciseStart) {
        const exercise: RawExercise = {
          // "FC1a: Back Squat" -> "Back Squat" (the complex is already shown by its section)
          name: String(row[nameCol]).replace(/^[A-Z]{1,3}\d{1,2}[a-z]?\s*[:.)]\s*/, '').trim() || String(row[nameCol]),
          section: currentSection,
          coachingNote: null,
          sets: [],
        }

        let j = i
        while (j < rows.length) {
          const r = rows[j]
          const setLabel = r[setCol]
          if (!isSetLabel(setLabel)) break
          if (j !== i && r[0] !== null) break

          const weeksData: Record<number, { prescWt: any; prescReps: any }> = {}
          for (const wb of weekBlocks) {
            const sc = wb.startCol
            // "—" or "-" means this set isn't done that week
            const blank = (v: any) => v === null || v === undefined || (typeof v === 'string' && /^\s*[—–-]?\s*$/.test(v))
            const prescWt = blank(r[sc]) ? null : r[sc]
            const prescReps = blank(r[sc + 1]) ? null : r[sc + 1]
            if (prescWt !== null || prescReps !== null) {
              weeksData[wb.week] = { prescWt, prescReps }
            }
          }

          exercise.sets.push({ setLabel: setLabel.trim(), weeks: weeksData })
          j++
        }

        if (j < rows.length) {
          const trailer = rows[j][0]
          if (typeof trailer === 'string' && trailer.includes('📋')) {
            exercise.coachingNote = trailer.replace('📋', '').trim()
            j++
          }
        }

        if (currentDay) currentDay.exercises.push(exercise)
        i = j
        continue
      }

      i++
    }

    for (const wb of weekBlocks) {
      weekCounter++
      const week: ParsedWeek = {
        phaseTitle: sheetName,
        refMaxes,
        localWeek: wb.week,
        absoluteWeek: weekCounter,
        days: [],
      }

      for (const rawDay of rawDays) {
        const day: ParsedDay = {
          title: rawDay.title,
          warmup: rawDay.warmup && rawDay.warmup.items.length > 0 ? rawDay.warmup : null,
          exercises: [],
        }
        for (const rawEx of rawDay.exercises) {
          const setsThisWeek = rawEx.sets
            .filter(s => s.weeks[wb.week])
            .map(s => ({
              setLabel: s.setLabel,
              prescWt: cellText(s.weeks[wb.week].prescWt),
              prescReps: s.weeks[wb.week].prescReps !== null ? String(s.weeks[wb.week].prescReps) : null,
            }))
          if (setsThisWeek.length > 0) {
            day.exercises.push({
              name: rawEx.name,
              section: rawEx.section,
              coachingNote: rawEx.coachingNote,
              sets: setsThisWeek,
            })
          }
        }
        if (day.exercises.length > 0) week.days.push(day)
      }

      allWeeks.push(week)
    }
  }

  // Nothing in the usual layout? Try the 'one tab per day, weeks left to right' layout
  if (allWeeks.length === 0) return parseExcelAcross(workbook)
  return mergeDayTabs(allWeeks)
}

/**
 * Some plans put ONE DAY on each tab ("P3 MON LOWER", "P3 TUE PUSH-PULL"...) with the weeks side by side.
 * Read tab by tab that looks like 4 one-day phases, so put it back together: week 1 = day 1 of every tab, and so on.
 */
function mergeDayTabs(weeks: ParsedWeek[]): ParsedWeek[] {
  const tabs: ParsedWeek[][] = []
  for (const w of weeks) {
    const last = tabs[tabs.length - 1]
    if (last && last[0].phaseTitle === w.phaseTitle) last.push(w)
    else tabs.push([w])
  }
  const n = tabs[0]?.length ?? 0
  const looksLikeDayTabs =
    tabs.length >= 2 &&
    tabs.every(t => t.length === n) &&
    weeks.every(w => w.days.length <= 1) &&
    weeks.some(w => w.days.length === 1)
  if (!looksLikeDayTabs) return weeks

  // Name the block from what the tabs share ("P3 MON LOWER" + "P3 TUE PUSH-PULL" -> "P3")
  const names = tabs.map(t => t[0].phaseTitle)
  let prefix = names[0]
  for (const nm of names) while (prefix && !nm.startsWith(prefix)) prefix = prefix.slice(0, -1)
  prefix = prefix.replace(/[\s—–:-]+$/, '').trim()
  const phase = /^P\d+$/i.test(prefix) ? `Phase ${prefix.slice(1)}` : prefix || 'Program'

  return Array.from({ length: n }, (_, i) => ({
    phaseTitle: phase,
    refMaxes: tabs[0][i].refMaxes,
    localWeek: i + 1,
    absoluteWeek: i + 1,
    days: tabs.flatMap(t => t[i].days),
  }))
}