// "Band ER + Prone Y" in a program cell means two exercises done back to back (a superset),
// not one exercise. This decides when a "+" name should be split, and into what.

// Words that describe how to do the first exercise, not a second exercise
const MODIFIER = /^(iso(metric)? holds?|holds?|\d+[- ]?(s|sec|second)s?\b.*|lift-?offs?|harness|carries|top[- ]leg lift|(hip flexor |overhead )?reach|ankle weights|dbs?|lift|stop in .*|crossover|\d+\s*(yd|yds|yard|m)\b.*|sprint combo|forearm( work| circuit)?)$/i
// One-word exercises that are fine on their own
const ONE_WORD_OK = new Set(['copenhagen', 'nordic', 'pallof', 'cat-cow', 'pull-apart', 'y-raise'])
// Whole rows that are a named circuit or flow, not a pair of exercises
const PLACEHOLDER = /circuit|flow\b|mobility tab|complex|finisher|close-out|arm care [a-z]\b/i

function topLevelParts(s: string): string[] {
  const parts: string[] = []
  let depth = 0, cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(') depth++
    if (c === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && s.startsWith(' + ', i)) { parts.push(cur.trim()); cur = ''; i += 2; continue }
    cur += c
  }
  parts.push(cur.trim())
  return parts
}

/** The separate exercises in a "+" name, or null when it should stay one exercise */
export function splitCombo(name: string): string[] | null {
  if (!name.includes(' + ') || PLACEHOLDER.test(name)) return null
  const clean = name.replace(/\s*(\(\s*superset\s*\)|[—–-]\s*superset|\bsuperset)\s*$/i, '').trim()
  const parts = topLevelParts(clean)
  if (parts.length < 2) return null
  if (parts[0].includes(':')) return null // "Ankle Stiffness: Pogo + Line Hops" is one drill
  for (const p of parts) {
    if (!p || MODIFIER.test(p)) return null
    const words = p.split(/\s+/)
    if (words.length === 1 && !ONE_WORD_OK.has(p.toLowerCase())) return null
    if (/^\d+\/\d+$/.test(p)) return null // "90/90" alone
  }
  return parts.map(p => p.replace(/\s*\((paired|superset)\)\s*$/i, '').trim())
}

/**
 * Turn every "A + B" exercise into separate exercises A and B that share a superset section,
 * so athletes see (and log) each one. Safe to run more than once.
 */
export function splitCombosInWeeks<W extends { days: { exercises: { name: string; section: string | null }[] }[] }>(weeks: W[]): W[] {
  for (const week of weeks) {
    for (const day of week.days) {
      // Next superset letter not already used that day
      const used = new Set<string>()
      for (const ex of day.exercises) {
        const m = ex.section?.match(/(?:SUPERSET|COMPLEX|CIRCUIT)\s+([A-Z])\b/i)
        if (m) used.add(m[1].toUpperCase())
      }
      const nextLetter = () => {
        for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.has(c)) { used.add(c); return c }
        return 'Z'
      }
      const out: typeof day.exercises = []
      for (const ex of day.exercises) {
        const parts = splitCombo(ex.name)
        if (!parts) { out.push(ex); continue }
        const letter = nextLetter()
        const section = `${ex.section ? ex.section + ' · ' : ''}Superset ${letter}`
        for (const p of parts) out.push({ ...ex, name: p, section })
      }
      day.exercises = out
    }
  }
  return weeks
}
