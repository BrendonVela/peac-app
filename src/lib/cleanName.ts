// Cleans exercise names that came in from plans with extra labels around them:
//   "A1 Back Squat — heavy"            -> "Back Squat"   (cue: heavy, superset A)
//   "A1 Barbell or DB Bench — heavy"   -> "Barbell Bench" (swap: DB Bench, cue: heavy)
//   "FRENCH CONTRAST 1: Back squat"    -> "Back squat"
//   "Hill Sprints (or stair sprints)"  -> "Hill Sprints"  (swap: Stair Sprints)

export interface CleanName {
  name: string
  /** Coaching cue that was part of the name ("heavy", "3-sec lower") */
  cue: string | null
  /** Interchangeable exercises written as "X or Y" -> become swaps */
  alts: string[]
  /** Pair label like "A" from "A1" (exercises sharing it are a superset) */
  pair: string | null
}

// How to do it, not what it is
const CUE = /^(heavy|light|moderate|max(imal)? (intent|effort|velocity)|fast|fast up|fast reps|explosive( up| pull| concentric)?|fast concentric|speed|technique|top set|heavy top set|dead-stop explosive|(full )?triphasic( by block)?|light load|weighted|controlled|slow( eccentric)?|\d+(\.\d+)?[- ]?(s|sec|second)s?\b.*|.*\beccentric\b.*|.*\bpause\b.*|.*\bhold\b.*|.*\biso(metric)?\b.*|tempo .*|alternate weekly|distance or velocity|max velocity|step down|stick( landing| the landing)?|stick \d+ ?s(ec)?)$/i

// Words that mark a phrase as a cue
const CUE_WORD = /\b(explos\w*|max(imal|imum)?|triphasic|ecc|eccentric|iso|isometric|pauses?|paused|tempo|holds?|heavy|light|lightest|speed|velocity|immediately|right after|variation|concentric|near maximal|violent|snap|lhp|rhp|pitching leg|progressive|wks?\s?\d+|hip drive|throwing arm|one arm|timed test|weighted|assisted|as needed|unloaded|clap|drop each rep|from floor|lockout|squeeze|stick)\b|\d+\s?(kg|lb|%)/i
const isCue = (s: string) => CUE.test(s.trim()) || CUE_WORD.test(s)

const PREFIX = [
  /^→\s*/,
  /^(summer\s+)?contrast:\s*/i,
  /^french contrast\s*(el\.?\s*)?\d*\s*:\s*/i,
  /^fc\s*el\.?\s*\d+\s*[-:]\s*/i,
  /^fc\d+[a-z]\s+/i,
  /^uc\s+[a-z]\s+/i,
  /^med ball:\s*/i,
]

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Words that can share the noun after "or": "Barbell or DB Bench" = "Barbell Bench" or "DB Bench"
const SHARED = /^(barbell|bb|db|dumbbell|kb|kettlebell|back|front|band|banded|cable|machine|slider|trap bar|landmine|incline|flat|seated|standing)$/i

/** Remove plan labels like "FRENCH CONTRAST 1:", "FC el.3 -", "MED BALL:" from the start of a name */
export function stripPrefix(raw: string): string {
  let name = raw.replace(/\s+/g, ' ').trim()
  for (const p of PREFIX) name = name.replace(p, '')
  return name
}

export function cleanExerciseName(raw: string): CleanName {
  let name = stripPrefix(raw)
  const cues: string[] = []
  let pair: string | null = null

  const lab = name.match(/^([A-H])(\d)[a-z]?[.:)]?\s+(?=\S)/)
  if (lab) { pair = lab[1]; name = name.slice(lab[0].length) }

  // Trailing cues: "— heavy", "- pause below the knee", "(3-sec eccentric)", "w/ 3s pause on chest"
  for (let guard = 0; guard < 3; guard++) {
    const dash = name.match(/^(.*?\S)\s+[—–-]\s+(.+)$/)
    if (dash && isCue(dash[2])) { cues.unshift(dash[2].trim()); name = dash[1]; continue }
    const lbl = name.match(/^(.*\S)\s*\(([A-H])\d\)$/) // "... (A2)"
    if (lbl) { pair ??= lbl[2]; name = lbl[1]; continue }
    const par = name.match(/^(.*\S)\s*\(([^()]+)\)$/)
    const sharedOr = par && /^(\w+) or (\w+)$/i.exec(par[2].trim())
    if (par && isCue(par[2]) && !(sharedOr && SHARED.test(sharedOr[1]) && SHARED.test(sharedOr[2]))) { cues.unshift(par[2].trim()); name = par[1]; continue }
    const plus = name.match(/^(.*\S)\s+\+\s+([^+]+)$/) // "Hip Airplane + 3-sec End Range Hold"
    if (plus && isCue(plus[2])) { cues.unshift(plus[2].trim()); name = plus[1]; continue }
    const w = name.match(/^(.*\S)\s+w\/\s*(\d.*(pause|hold|squeeze).*)$/i)
    if (w) { cues.unshift(w[2].trim()); name = w[1]; continue }
    break
  }

  // "Hill Sprints (or stair sprints)"
  const alts: string[] = []
  const orPar = name.match(/^(.*\S)\s*\(or ([^()]+)\)$/i)
  if (orPar) { name = orPar[1]; alts.push(cap(orPar[2].trim())) }
  // "Bench press (BB or DB)" -> "Barbell Bench press" / "DB Bench press"
  const parOr = name.match(/^(.*\S)\s*\((\w+) or (\w+)\)$/i)
  if (parOr && SHARED.test(parOr[2]) && SHARED.test(parOr[3])) {
    const full = (w: string) => (/^bb$/i.test(w) ? 'Barbell' : w)
    name = `${full(parOr[2])} ${parOr[1]}`
    alts.push(`${full(parOr[3])} ${parOr[1]}`)
  } else if (parOr && isCue(`${parOr[2]} or ${parOr[3]}`)) {
    cues.push(`${parOr[2]} or ${parOr[3]}`); name = parOr[1]
  }
  // "Leg Press or Hack Squat", "Barbell or DB Bench"
  const orParts = name.split(/\s+or\s+/i)
  if (orParts.length === 2 && !/[()]/.test(orParts[0]) && !/[—–]/.test(orParts[0])) {
    let [a, b] = orParts.map(s => s.trim())
    const bTail = b.match(/^(.*\S)\s*\(([^()]+)\)$/)
    if (bTail && CUE.test(bTail[2])) { cues.push(bTail[2]); b = bTail[1] }
    const bLbl = b.match(/^(.*\S)\s*\(([A-H])\d\)$/)
    if (bLbl) { b = bLbl[1] }
    const bDash = b.match(/^(.*?\S)\s+[—–]\s+(.+)$/)
    if (bDash) { cues.push(bDash[2]); b = bDash[1] }
    if (a.split(' ').length === 1 && b.split(' ').length > 1 && SHARED.test(a)) {
      // shared noun: "Barbell or DB Bench" -> "Barbell Bench" / "DB Bench"
      a = `${a} ${b.split(' ').slice(1).join(' ')}`
    }
    if (a && b) { name = a; alts.push(cap(b)) }
  }

  return { name: cap(name.trim()), cue: cues.length ? cues.join(', ') : null, alts, pair }
}
