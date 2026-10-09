// parse-test.js
// Run with: node parse-test.js "path/to/your/program.xlsx"
// This is a STANDALONE test script — it does not touch your database.
// It just proves we can correctly read the structure out of your Excel file.

const XLSX = require('xlsx')

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: node parse-test.js "path/to/file.xlsx"')
  process.exit(1)
}

const workbook = XLSX.readFile(filePath)

// Skip the first sheet (Program Overview) for now — we'll handle that separately.
const phaseSheets = workbook.SheetNames.filter(name => name !== workbook.SheetNames[0])

console.log(`Found ${workbook.SheetNames.length} sheets total.`)
console.log(`Sheet names:`, workbook.SheetNames)
console.log('')

for (const sheetName of phaseSheets) {
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

  console.log(`\n=== SHEET: ${sheetName} (${rows.length} rows) ===`)

  let currentDay = null
  let currentSection = null
  let exerciseCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const firstCell = row[0]
    const secondCell = row[1]

    const firstTrimmed = typeof firstCell === 'string' ? firstCell.trim() : firstCell

    if (typeof firstTrimmed === 'string' && firstTrimmed.startsWith('DAY ')) {
      currentDay = firstTrimmed
      console.log(`  [DAY] ${currentDay}`)
      continue
    }

    if (typeof firstTrimmed === 'string' && firstTrimmed.startsWith('▸')) {
      currentSection = firstTrimmed
      console.log(`    [SECTION] ${currentSection}`)
      continue
    }

    if (typeof firstCell === 'number' && secondCell) {
      exerciseCount++
      console.log(`      [EXERCISE #${firstCell}] ${secondCell}`)
    }
  }

  console.log(`  --> Total exercises detected in this sheet: ${exerciseCount}`)
}