const XLSX = require('xlsx')

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: node parse-test-v2.js "path/to/file.xlsx"')
  process.exit(1)
}

const workbook = XLSX.readFile(filePath)
const phaseSheets = workbook.SheetNames.filter(name => name !== workbook.SheetNames[0])

function parseSheet(sheetName) {
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

  let headerRowIdx = null
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][4] === 'SET') {
      headerRowIdx = i
      break
    }
  }
  if (headerRowIdx === null) return { weekBlocks: [], days: [] }

  const header = rows[headerRowIdx]
  const weekBlocks = []
  let weekNum = 0
  for (let col = 0; col < header.length; col++) {
    if (header[col] === 'PRESC WT') {
      weekNum++
      weekBlocks.push({ week: weekNum, startCol: col })
    }
  }

  const days = []
  let currentDay = null
  let currentSection = null
  let i = headerRowIdx + 1

  while (i < rows.length) {
    const row = rows[i]
    const first = row[0]
    const firstTrimmed = typeof first === 'string' ? first.trim() : first

    if (typeof firstTrimmed === 'string' && firstTrimmed.startsWith('DAY ')) {
      currentDay = { title: firstTrimmed, exercises: [] }
      days.push(currentDay)
      i++
      continue
    }

    if (typeof firstTrimmed === 'string' && firstTrimmed.startsWith('▸')) {
      currentSection = firstTrimmed.replace('▸', '').trim()
      i++
      continue
    }

    if (typeof first === 'number' && row[1]) {
      const exercise = {
        number: first,
        name: row[1],
        section: currentSection,
        sets: [],
      }

      let j = i
      while (j < rows.length) {
        const r = rows[j]
        const setLabel = r[4]
        const isSetRow = typeof setLabel === 'string' && setLabel.trim().startsWith('Set')
        if (!isSetRow) break
        if (j !== i && r[0] !== null) break

        const weeksData = []
        for (const wb of weekBlocks) {
          const sc = wb.startCol
          const prescWt = r[sc]
          const prescReps = r[sc + 1]
          const actualWt = r[sc + 2]
          const actualReps = r[sc + 3]
          const notes = r[sc + 4]
          if (prescWt !== null || prescReps !== null) {
            weeksData.push({ week: wb.week, prescWt, prescReps, actualWt, actualReps, notes })
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

  return { weekBlocks, days }
}

for (const sheetName of phaseSheets) {
  const result = parseSheet(sheetName)
  const totalExercises = result.days.reduce((sum, d) => sum + d.exercises.length, 0)
  console.log(`\n=== ${sheetName} ===`)
  console.log(`  Weeks detected: ${result.weekBlocks.length}`)
  console.log(`  Days detected: ${result.days.length}`)
  console.log(`  Total exercises: ${totalExercises}`)
}

console.log('\n\n--- SAMPLE DETAIL: first exercise of first day of first phase sheet ---')
const sample = parseSheet(phaseSheets[0])
if (sample.days[0] && sample.days[0].exercises[0]) {
  console.log(JSON.stringify(sample.days[0].exercises[0], null, 2))
}