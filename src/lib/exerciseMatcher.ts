// src/lib/exerciseMatcher.ts
// Matches exercise names from the Excel file to the exercise library.
// Order: no-video list -> alias list -> rules (abbreviations, dashes, parentheses,
// default equipment) -> "contains" -> close match. No match = created without video.

export type ExerciseRef = { id: string; name: string; hasVideo?: boolean }
export type MatchResult = ExerciseRef & {
  how: 'alias' | 'normalized' | 'stripped' | 'equipment' | 'contains' | 'fuzzy'
  score?: number
}

// ============================================================
// 1) NAMES TO ALWAYS SKIP (no matching video in the library)
//    These get created WITHOUT a video and show in "No Video".
//    Add or remove lines as needed. Case doesn't matter.
// ============================================================
const SKIP_LIST: string[] = [
  "90/90 Pelvic Mobility + Hip-Shoulder Sep Drill",
  "Ab Wheel Rollout — pause at extension",
  "Anterior Pelvic Tilt Drill (standing)",
  "Bootstrappers (deep squat to hip circle)",
  "Build-Up Sprints",
  "Cat-Cow + Quadruped Hip Extension",
  "Copenhagen Plank",
  "Copenhagen Plank Adductor Hold",
  "Copenhagen Side Plank (iso hold)",
  "Couch Stretch (hip flexor)",
  "DB Hammer Curl (3-sec eccentric)",
  "Forearm Flexor/Extensor Eccentric",
  "Forearm/Wrist Roller",
  "Full Mobility Close-Out: T-Spine + Shoulder + Hip",
  "Hip-Shoulder Separation Drill (resistance band)",
  "Landmine Clean to Press (SL Stance)",
  "MB Drop to Scoop Throw",
  "Posterior Pelvic Tilt Drill (supine)",
  "Prone Y-Holds + Banded Over & Backs",
  "Resisted Sled Sprint",
  "SA DB Tricep Kickback (3-sec eccentric)",
  "Seated T-Spine Rotation with Stick",
  "SL Box Jump (max height, stick 2 sec)",
  "SL Box Squat (pause 3-sec at bottom)",
  "Sleeper Stretch + Cross-Body Stretch",
  "Spanish Squat — 5-sec isometric hold",
  "Sprint – Decelerate – Sprint",
  "Sprint–Back Pedal–Sprint (5–5–10 yd)",
  "T-Spine + Hip Mobility Full Circuit",
  "T-Spine + Shoulder Mobility Finisher",
  "Thrower's Ten (abbreviated — 6 key exercises)",
  "Thrower's Ten (complete circuit)",
  "Thrower's Ten (full circuit)",
  "Wrist Flexion/Extension with Light DB",
  "Wrist Flexor/Extensor Eccentric",
  "Wrist Flexor/Extensor Stretch",
]

// ============================================================
// 2) ALIASES: Excel name -> EXACT library title (with video)
//    Add new lines here for anything that lands in "No Video"
//    but should link to a library exercise.
// ============================================================
const ALIAS_LIST: Record<string, string> = {
  "90/90 Hip Stretch (end range pelvic work)": "90-90 Hip Rotation",
  "90/90 Hip Switches + 3-sec End Range Hold": "90-90 Hip Rotation",
  "Back Squat — 3-sec Eccentric": "Barbell Back Squat",
  "Band A's, W's, T's": "ATYT (Band Resisted)",
  "Banded A's + W's Superset": "ATYT (Band Resisted)",
  "Band ER + IR (arm in 90° abduction)": "Band Resisted Abduction and External Rotation at 90 Degrees",
  "Band ER/IR at 90° (Thrower's Ten)": "Band Resisted Abduction and External Rotation at 90 Degrees",
  "Band ER/IR Shoulder (90° abduction)": "Band Resisted Abduction and External Rotation at 90 Degrees",
  "Band Pull-Apart + Face Pull superset": "Banded Face Pull",
  "Box Jump – Max Height (Reactive)": "Box Jump (Countermovement)",
  "Cable/Band Half-Kneeling Chop (high to low)": "Half-Kneeling Cable Core Rotation (High to Low)",
  "Deep Hang + Spinal Decompression": "Dead Hang Lat Stretch",
  "Explosive SA Cable Row (hip loaded)": "Single Arm Cable Row (Square Stance)",
  "GHD Hip Extension (pause at top)": "GHD Back Extension",
  "Hang Power Clean": "Barbell Hang Clean",
  "Hang Power Clean (technical emphasis)": "Barbell Hang Clean",
  "KB Step-Up w/ Hip Lock at Top": "Dumbbell Step Up",
  "Step-Up with Isometric Top Hold (5 sec)": "Dumbbell Step Up",
  "Lateral Hurdle Hops → Stick (3 hurdles)": "Bilateral Hurdle Jumps (Moving Lateral)",
  "MB Rotational Pass to Wall (stride stance)": "Medicine Ball Rotational Throw",
  "MB Wall Ball Rotational (stride stance)": "Medicine Ball Rotational Throw",
  "MB Split-Stance Chest Pass (explosive)": "Medicine Ball Chest Pass (Wall)",
  "Pallof Press (anti-rotation isometric)": "Palloff Press (Band Resisted)",
  "Pallof Press Iso Hold": "Palloff Press (Band Resisted)",
  "Pause Back Squat — 2-sec pause at depth": "Barbell Back Squat (Pause)",
  "Pendlay Row — 2-sec pause at chest": "Barbell Pendlay Row",
  "Pendlay Row — Explosive Concentric": "Barbell Pendlay Row",
  "Pendlay Row — Max velocity pull": "Barbell Pendlay Row",
  "Prone Y-T-W Holds": "Chest Supported Y, T, W",
  "Push Press — light": "Barbell Push Press",
  "Rear-Foot Elevated Split Squat — 3-sec ecc": "Dumbbell Bulgarian Split Squat",
  "Rear-Foot Elevated Split Squat (pause 2-sec)": "Dumbbell Bulgarian Split Squat",
  "RFESS (LHP: left leg front = pitching leg) — Explosive": "Dumbbell Bulgarian Split Squat",
  "Weighted RFESS (LHP: left leg front = pitching leg)": "Dumbbell Bulgarian Split Squat",
  "SA DB Incline Row (pause at top)": "Chest Supported Dumbbell Row",
  "SA Incline DB Bench (controlled)": "Single Arm Dumbbell Incline Chest Press",
  "SA Standing Banded Reverse Fly": "Band Resisted Reverse Fly",
  "SL Hip Hinge to Balance (BW → KB)": "Single Leg Dumbbell Romanian Deadlift (RDL)",
  "SL Lateral Bound to Stick (opposite leg)": "Lateral Bound (Stick It)",
  "Snatch Grip Romanian DL (wide grip)": "Barbell Romanian Deadlift (RDL)",
  "Suitcase Carry + Pause": "Single Arm Farmer Carry",
  "T-Spine Extension over Foam Roller (3 positions)": "Thoracic Spine Mobility - Foam Roller & Barbell",
  "T-Spine Foam Roll + 90/90 Hip Stretch": "Thoracic Spine Mobility - Foam Roller & Barbell",
  "T-Spine Rotation in Side-Lying (thread the needle)": "Side Lying Thoracic Windmill",
  "Trap Bar DL — Isometric Tension Pull (ALL reps from FLOOR)": "Trap Bar Deadlift (Low Bar)",
  "Trap Bar DL — Pin Height Progressive (Anderson-style)": "Trap Bar Deadlift (Elevated)",
}

// ============================================================
// 3) RULES (for future programs)
// ============================================================

// Single-word abbreviations -> full words (lowercase keys)
const ABBREVIATIONS: Record<string, string> = {
  db: 'dumbbell', dbs: 'dumbbell', dumbell: 'dumbbell',
  bb: 'barbell',
  kb: 'kettlebell',
  mb: 'medicine ball', med: 'medicine',
  sl: 'single leg',
  sa: 'single arm',
  rdl: 'romanian deadlift', rdls: 'romanian deadlift',
  dl: 'deadlift',
  bss: 'bulgarian split squat',
  rfess: 'bulgarian split squat',
  pallof: 'palloff',
  bw: 'bodyweight',
  alt: 'alternating',
  iso: 'isometric',
  ghr: 'glute ham raise',
  ffe: 'front foot elevated',
  hk: 'half kneeling',
  oh: 'overhead',
  ext: 'external', int: 'internal', rot: 'rotation',
  er: 'external rotation', ir: 'internal rotation',
  pushup: 'push up', pushups: 'push up',
  situp: 'sit up', situps: 'sit up',
  pullup: 'pull up', pullups: 'pull up',
  chinup: 'chin up', chinups: 'chin up',
}

// Multi-word phrases -> library wording (applied before splitting into words)
const PHRASES: [RegExp, string][] = [
  [/rear[\s-]*foot[\s-]*elevated[\s-]*split[\s-]*squat/gi, 'bulgarian split squat'],
  [/hang power clean/gi, 'hang clean'],
]

const STOPWORDS = new Set(['w', 'with', 'and'])

// When no equipment is named, try these in order
const DEFAULT_EQUIPMENT = ['barbell', 'dumbbell']

const FUZZY_THRESHOLD = 0.8

// Removes "(notes)" and anything after " — " or " – "
function stripExtras(name: string): string {
  return name
    .replace(/\([^)]*\)?/g, ' ')
    .replace(/\s+[—–]\s+.*$/, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(name: string): string[] {
  let text = name.toLowerCase().replace(/w\//g, ' with ')
  for (const [re, rep] of PHRASES) text = text.replace(re, rep)
  const cleaned = text.replace(/[^a-z0-9]+/g, ' ').trim()

  const out: string[] = []
  for (const raw of cleaned.split(/\s+/)) {
    if (!raw) continue
    const expanded = ABBREVIATIONS[raw] ?? raw
    for (const t of expanded.split(' ')) {
      if (STOPWORDS.has(t)) continue
      const singular = t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t
      out.push(singular)
    }
  }
  return Array.from(new Set(out)).sort()
}

function dice(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b)
  const overlap = a.filter((t) => setB.has(t)).length
  return (2 * overlap) / (a.length + b.length)
}

const norm = (s: string) => s.trim().toLowerCase()

export function createExerciseMatcher(exercises: ExerciseRef[]) {
  const skip = new Set(SKIP_LIST.map(norm))
  const aliases = new Map(Object.entries(ALIAS_LIST).map(([k, v]) => [norm(k), v]))

  const byLower = new Map<string, ExerciseRef>()
  const byKey = new Map<string, ExerciseRef>()
  const entries: { ex: ExerciseRef; toks: string[] }[] = []

  // Exercises WITH videos first so they win any tie
  ;[...exercises]
    .sort((a, b) => Number(!!b.hasVideo) - Number(!!a.hasVideo))
    .forEach((ex) => {
      const toks = tokens(ex.name)
      if (!byLower.has(norm(ex.name))) byLower.set(norm(ex.name), ex)
      const key = toks.join(' ')
      if (!byKey.has(key)) byKey.set(key, ex)
      entries.push({ ex, toks })
    })

  const match = (name: string): MatchResult | null => {
    const lower = norm(name)

    // 1. Skip list
    if (skip.has(lower)) return null

    // 2. Alias list
    const target = aliases.get(lower)
    if (target) {
      const ex = byLower.get(norm(target))
      if (ex) return { ...ex, how: 'alias' }
      console.warn(`[import] Alias target not found in library: "${target}" (for "${name}")`)
    }

    // 3. Same words
    const toks = tokens(name)
    const full = byKey.get(toks.join(' '))
    if (full) return { ...full, how: 'normalized' }

    // 4. Same words after removing (notes) and " — notes"
    const strippedName = stripExtras(name)
    const sToks = tokens(strippedName)
    if (sToks.length > 0) {
      const stripped = byKey.get(sToks.join(' '))
      if (stripped) return { ...stripped, how: 'stripped' }

      // 5. Try adding default equipment (Pendlay Row -> Barbell Pendlay Row)
      for (const eq of DEFAULT_EQUIPMENT) {
        const withEq = byKey.get(tokens(`${eq} ${strippedName}`).join(' '))
        if (withEq) return { ...withEq, how: 'equipment' }
      }
    }

    // 6. A library name whose words ALL appear in the Excel name (most specific wins)
    const nameSet = new Set(toks)
    let contained: ExerciseRef | null = null
    let containedLen = 0
    for (const e of entries) {
      if (e.toks.length < 2) continue
      if (!e.toks.every((t) => nameSet.has(t))) continue
      if (e.toks.length > containedLen || (e.toks.length === containedLen && e.ex.hasVideo && !contained?.hasVideo)) {
        contained = e.ex
        containedLen = e.toks.length
      }
    }
    if (contained) return { ...contained, how: 'contains' }

    // 7. Close match
    const fToks = sToks.length > 0 ? sToks : toks
    let best: ExerciseRef | null = null
    let bestScore = 0
    for (const e of entries) {
      const s = dice(fToks, e.toks)
      if (s > bestScore || (s === bestScore && e.ex.hasVideo && !best?.hasVideo)) {
        bestScore = s
        best = e.ex
      }
    }
    if (best && bestScore >= FUZZY_THRESHOLD) return { ...best, how: 'fuzzy', score: bestScore }

    // No match -> created without a video
    return null
  }

  return { match }
}