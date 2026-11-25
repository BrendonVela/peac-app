import { cleanExerciseName, stripPrefix } from './cleanName'
import { aliasFor } from './exerciseAliases'

// "Band ER + Prone Y" in a program cell means two exercises done back to back (a superset),
// not one exercise. This decides when a "+" name should be split, and into what.

// Words that describe how to do the first exercise, not a second exercise
const MODIFIER = /^(iso(metric)? holds?|holds?|\d+[- ]?(s|sec|second)s?\b.*|lift-?offs?|harness|carries|top[- ]leg lift|(hip flexor |overhead )?reach|ankle weights|dbs?|lift|stop in .*|crossover|\d+\s*(yd|yds|yard|m)\b.*|sprint combo|forearm( work| circuit)?)$/i
// One-word exercises that are fine on their own
const ONE_WORD_OK = new Set(['copenhagen', 'nordic', 'pallof', 'cat-cow', 'pull-apart', 'y-raise'])
// Whole rows that are a named circuit or flow, not a pair of exercises
const PLACEHOLDER = /circuit|flow\b|mobility tab|complex|finisher|close-out|arm care [a-z]\b/i

// Named circuits and combos from the plans, with the exercises they stand for
// (read from the plans' MOBILITY tabs and coaching notes)
const KNOWN_GROUPS: Record<string, string[]> = {
  "full arm care circuit": [
    "Band Resisted External Rotation",
    "Band Resisted Internal Rotation",
    "Prone Y-T-W"
  ],
  "full arm care circuit (er, ir, y, t, w)": [
    "Band Resisted External Rotation",
    "Band Resisted Internal Rotation",
    "Prone Y-T-W"
  ],
  "full arm care circuit + forearm work": [
    "Band Resisted External Rotation",
    "Band Resisted Internal Rotation",
    "Prone Y-T-W",
    "Forearm/Wrist Roller",
    "DB Pronation / Supination"
  ],
  "full arm care + forearm circuit": [
    "Band Resisted External Rotation",
    "Band Resisted Internal Rotation",
    "Prone Y-T-W",
    "Forearm/Wrist Roller",
    "DB Pronation / Supination"
  ],
  "arm care a — band er/ir + scap y": [
    "Band Resisted External Rotation",
    "Band Resisted Internal Rotation",
    "Band Y-Raise (low trap)"
  ],
  "arm care b — prone y-t-w + forearm": [
    "Prone Y-T-W",
    "Wrist Flexion/Extension with Light DB",
    "DB Pronation / Supination"
  ],
  "cuff circuit: band er/ir · face pull · y-raise": [
    "Band Resisted External Rotation",
    "Band Resisted Internal Rotation",
    "Banded Face Pull",
    "Band Y-Raise (low trap)"
  ],
  "band er, ir, prone t — full arm care circuit": [
    "Band Resisted External Rotation",
    "Band Resisted Internal Rotation",
    "Prone T"
  ],
  "full thrower's ten circuit": [
    "Band D2 Flexion / Extension",
    "Band Resisted External Rotation",
    "Band Resisted Internal Rotation",
    "Band Resisted Abduction and External Rotation at 90 Degrees",
    "DB Scaption",
    "Side-Lying DB External Rotation",
    "Prone Y-T-W"
  ],
  "thrower's ten (complete circuit)": [
    "Band D2 Flexion / Extension",
    "Band Resisted External Rotation",
    "Band Resisted Internal Rotation",
    "Band Resisted Abduction and External Rotation at 90 Degrees",
    "DB Scaption",
    "Side-Lying DB External Rotation",
    "Prone Y-T-W"
  ],
  "thrower's ten (full circuit)": [
    "Band D2 Flexion / Extension",
    "Band Resisted External Rotation",
    "Band Resisted Internal Rotation",
    "Band Resisted Abduction and External Rotation at 90 Degrees",
    "DB Scaption",
    "Side-Lying DB External Rotation",
    "Prone Y-T-W"
  ],
  "thrower's ten circuit": [
    "Band D2 Flexion / Extension",
    "Band Resisted External Rotation",
    "Band Resisted Internal Rotation",
    "Band Resisted Abduction and External Rotation at 90 Degrees",
    "DB Scaption",
    "Side-Lying DB External Rotation",
    "Prone Y-T-W"
  ],
  "thrower's ten (abbreviated — 6 key exercises)": [
    "Band D2 Flexion / Extension",
    "Side-Lying DB External Rotation",
    "DB Scaption",
    "Banded Face Pull",
    "Band row",
    "Sleeper Stretch (gentle)"
  ],
  "hip + t-spine circuit — see mobility tab": [
    "Foam Roller T-Spine Extension",
    "T-Spine Open Book",
    "Thread the Needle",
    "Quadruped Thoracic Rotations",
    "Side Lying Thoracic Windmill",
    "90/90 Hip Switch → Lift-Off",
    "Hip Airplane",
    "Couch Stretch w/ PPT",
    "Worlds Greatest Stretch",
    "Adductor Rock Back"
  ],
  "full mobility circuit — see mobility tab": [
    "Foam Roller T-Spine Extension",
    "T-Spine Open Book",
    "Thread the Needle",
    "Quadruped Thoracic Rotations",
    "Side Lying Thoracic Windmill",
    "90/90 Hip Switch → Lift-Off",
    "Hip Airplane",
    "Couch Stretch w/ PPT",
    "Worlds Greatest Stretch",
    "Adductor Rock Back"
  ],
  "full circuit — see mobility tab": [
    "Foam Roller T-Spine Extension",
    "T-Spine Open Book",
    "Thread the Needle",
    "Quadruped Thoracic Rotations",
    "Side Lying Thoracic Windmill",
    "90/90 Hip Switch → Lift-Off",
    "Hip Airplane",
    "Couch Stretch w/ PPT",
    "Worlds Greatest Stretch",
    "Adductor Rock Back"
  ],
  "full mobility circuit": [
    "Foam Roller T-Spine Extension",
    "T-Spine Open Book",
    "Thread the Needle",
    "Quadruped Thoracic Rotations",
    "Side Lying Thoracic Windmill",
    "90/90 Hip Switch → Lift-Off",
    "Hip Airplane",
    "Couch Stretch w/ PPT",
    "Worlds Greatest Stretch",
    "Adductor Rock Back"
  ],
  "mobility flow (mobility tab - full circuit)": [
    "Foam Roller T-Spine Extension",
    "T-Spine Open Book",
    "Thread the Needle",
    "Quadruped Thoracic Rotations",
    "Side Lying Thoracic Windmill",
    "90/90 Hip Switch → Lift-Off",
    "Hip Airplane",
    "Couch Stretch w/ PPT",
    "Worlds Greatest Stretch",
    "Adductor Rock Back"
  ],
  "shoulder + t-spine circuit — see mobility tab": [
    "Shoulder CARs",
    "Sleeper Stretch (gentle)",
    "Cross-Body Stretch",
    "Doorway Pec Stretch",
    "Dead Hang Lat Stretch",
    "Prone Y-T-W",
    "Band Resisted External Rotation",
    "Scap Push Up",
    "T-Spine Open Book",
    "Quadruped Thoracic Rotations",
    "Foam Roller T-Spine Extension"
  ],
  "t-spine + shoulder mobility finisher": [
    "T-Spine Open Book",
    "Sleeper Stretch (gentle)",
    "Shoulder CARs"
  ],
  "t-spine + hip mobility full circuit": [
    "Quadruped Thoracic Rotations",
    "T-Spine Open Book",
    "Worlds Greatest Stretch",
    "90-90 Pails and Rails Hip Internal Rotation",
    "Couch Stretch",
    "Adductor Rock Back"
  ],
  "full t-spine + shoulder + hip mobility circuit": [
    "Quadruped Thoracic Rotations",
    "T-Spine Open Book",
    "Shoulder CARs",
    "Sleeper Stretch (gentle)",
    "Worlds Greatest Stretch",
    "Couch Stretch",
    "Adductor Rock Back"
  ],
  "full mobility close-out: t-spine + shoulder + hip": [
    "Quadruped Thoracic Rotations",
    "T-Spine Open Book",
    "Shoulder CARs",
    "Sleeper Stretch (gentle)",
    "Worlds Greatest Stretch",
    "Couch Stretch",
    "Adductor Rock Back"
  ],
  "hip flexor + adductor flow (mobility tab)": [
    "Couch Stretch",
    "Half-Kneeling Hip Flexor Stretch",
    "Adductor Rock Back",
    "Cossack Squat"
  ],
  "mobility: 90/90 · couch stretch · t-spine · calf": [
    "90-90 Hip Rotation",
    "Couch Stretch",
    "Quadruped Thoracic Rotations",
    "Calf Stretch"
  ],
  "hammer curl + triceps + rear delt": [
    "DB Hammer Curl",
    "DB Overhead Triceps Extension",
    "Rear Delt Fly"
  ],
  "lateral raise + hammer curl + triceps": [
    "Dumbbell Lateral Raise (Standing)",
    "DB Hammer Curl",
    "DB Overhead Triceps Extension"
  ],
  "lat + pec doorway stretch": [
    "Dead Hang Lat Stretch",
    "Doorway Pec Stretch"
  ],
  "lat + pec stretch": [
    "Dead Hang Lat Stretch",
    "Doorway Pec Stretch"
  ],
  "calf + tib raise": [
    "Standing Calf Raise",
    "Tibialis Raise"
  ],
  "calf + tibialis": [
    "Standing Calf Raise",
    "Tibialis Raise"
  ],
  "tibialis + calf": [
    "Tibialis Raise",
    "Standing Calf Raise"
  ],
  "tibialis + calf raise": [
    "Tibialis Raise",
    "Standing Calf Raise"
  ]
}
// Names that look like two exercises but are one drill
const NEVER_SPLIT = new Set(['bench lat + thoracic sink'])

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function topLevelParts(s: string): string[] {
  const parts: string[] = []
  let depth = 0, cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(') depth++
    if (c === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && s.startsWith(' + ', i)) { parts.push(cur.trim()); cur = ''; i += 2; continue }
    if (depth === 0 && s.startsWith(' -> ', i)) { parts.push(cur.trim()); cur = ''; i += 3; continue } // contrast pair
    cur += c
  }
  parts.push(cur.trim())
  return parts
}

/** The separate exercises in a "+" name, or null when it should stay one exercise */
export function splitCombo(name: string): string[] | null {
  const key = name.trim().toLowerCase()
  if (KNOWN_GROUPS[key]) return KNOWN_GROUPS[key]
  if (NEVER_SPLIT.has(key)) return null
  name = stripPrefix(name)
  if (!(name.includes(' + ') || name.includes(' -> ')) || PLACEHOLDER.test(name)) return null
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
        const lab = stripPrefix(ex.name).match(/^([A-H])\d/) // "A1 Back Squat" uses A
        if (lab) used.add(lab[1])
      }
      const nextLetter = () => {
        for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.has(c)) { used.add(c); return c }
        return 'Z'
      }
      const out: typeof day.exercises = []
      for (const ex of day.exercises) {
        const parts = splitCombo(ex.name)
        if (!parts) { out.push(ex); continue }
        // Already in a superset/circuit: the separate exercises just join it
        const section = ex.section && /SUPERSET|SUPER SET|COMPLEX|CIRCUIT|TRI-?SET|GIANT SET/i.test(ex.section)
          ? ex.section
          : `${ex.section ? ex.section + ' · ' : ''}${parts.length >= 3 ? 'Circuit' : 'Superset'} ${nextLetter()}`
        for (const p of parts) out.push({ ...ex, name: p, section })
      }
      // Clean each name: "A1 Back Squat — heavy" -> "Back Squat" (cue "heavy", superset A)
      const pairs = new Map<string, number>()
      const cleaned = out.map(ex => {
        const c = cleanExerciseName(ex.name)
        if (c.pair) pairs.set(`${ex.section ?? ''}|${c.pair}`, (pairs.get(`${ex.section ?? ''}|${c.pair}`) ?? 0) + 1)
        return { ex, c }
      })
      day.exercises = cleaned.map(({ ex, c }) => {
        const e: any = { ...ex, name: c.name } // eslint-disable-line @typescript-eslint/no-explicit-any
        if (c.cue) e.coachingNote = [cap(c.cue), e.coachingNote].filter(Boolean).join('. ')
        // Same exercise under another name: "Bench press" -> "Barbell Bench Press"
        const al = aliasFor(e.name)
        if (al) {
          e.name = al[0]
          if (al[1]) e.coachingNote = [al[1], e.coachingNote].filter(Boolean).join('. ')
        }
        if (c.alts.length) e.alts = Array.from(new Set([...(e.alts ?? []), ...c.alts]))
        const grouped = ex.section && /SUPERSET|SUPER SET|COMPLEX|CIRCUIT|TRI-?SET|GIANT SET/i.test(ex.section)
        if (c.pair && (pairs.get(`${ex.section ?? ''}|${c.pair}`) ?? 0) >= 2 && !grouped) {
          e.section = `${ex.section ? ex.section + ' · ' : ''}Superset ${c.pair}`
        }
        return e
      })
    }
  }
  return weeks
}
