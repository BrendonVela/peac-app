import * as XLSX from 'xlsx'

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

function isWarmupSection(section: string | null): boolean {
  return !!section && /WARM[\s-]?UP/i.test(section)
}

export interface ParsedWeek {
  phaseTitle: string
  localWeek: number
  absoluteWeek: number
  days: ParsedDay[]
}

export function parseExcelProgram(buffer: ArrayBuffer): ParsedWeek[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const phaseSheets = workbook.SheetNames.filter(name => name !== workbook.SheetNames[0])

  const allWeeks: ParsedWeek[] = []
  let weekCounter = 0

  for (const sheetName of phaseSheets) {
    const sheet = workbook.Sheets[sheetName]
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

    let headerRowIdx: number | null = null
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][4] === 'SET') {
        headerRowIdx = i
        break
      }
    }
    if (headerRowIdx === null) continue

    const header = rows[headerRowIdx]
    const weekBlocks: { week: number; startCol: number }[] = []
    let localWeekNum = 0
    for (let col = 0; col < header.length; col++) {
      if (header[col] === 'PRESC WT') {
        localWeekNum++
        weekBlocks.push({ week: localWeekNum, startCol: col })
      }
    }
    if (weekBlocks.length === 0) continue

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

      if (typeof firstTrimmed === 'string' && firstTrimmed.startsWith('DAY ')) {
        currentDay = { title: firstTrimmed, warmup: null, exercises: [] }
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

      if (typeof first === 'number' && row[1]) {
        const exercise: RawExercise = {
          name: String(row[1]),
          section: currentSection,
          coachingNote: null,
          sets: [],
        }

        let j = i
        while (j < rows.length) {
          const r = rows[j]
          const setLabel = r[4]
          const isSetRow = typeof setLabel === 'string' && setLabel.trim().startsWith('Set')
          if (!isSetRow) break
          if (j !== i && r[0] !== null) break

          const weeksData: Record<number, { prescWt: any; prescReps: any }> = {}
          for (const wb of weekBlocks) {
            const sc = wb.startCol
            const prescWt = r[sc]
            const prescReps = r[sc + 1]
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
              prescWt: s.weeks[wb.week].prescWt !== null ? String(s.weeks[wb.week].prescWt) : null,
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

  return allWeeks
}