// Form analysis from body points found in a video (MediaPipe Pose, 33 points, normalized 0..1).
// Everything here is plain math so it runs the same on any phone or computer.

export type ExerciseKind = 'squat' | 'hinge' | 'lunge' | 'press' | 'pull' | 'jump' | 'sprint' | 'throw' | 'swing' | 'other'
export type View = 'side' | 'front'

export const EXERCISE_LABEL: Record<ExerciseKind, string> = {
  squat: 'Squat',
  hinge: 'Hinge / Deadlift',
  lunge: 'Lunge / Split squat',
  press: 'Press / Bench',
  pull: 'Row / Pull-up',
  jump: 'Jump / Landing',
  sprint: 'Sprint start',
  throw: 'Throw / Pitch',
  swing: 'Swing (bat / golf)',
  other: 'Any movement',
}

/** Joints we keep (MediaPipe index -> short name) */
export const JOINTS = {
  nose: 0, lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28, lHeel: 29, rHeel: 30, lFoot: 31, rFoot: 32,
} as const
export type JointName = keyof typeof JOINTS
export const JOINT_NAMES = Object.keys(JOINTS) as JointName[]

/** Lines of the skeleton (left side, right side, middle) */
export const BONES: [JointName, JointName, 'L' | 'R' | 'C'][] = [
  ['lShoulder', 'rShoulder', 'C'], ['lHip', 'rHip', 'C'],
  ['lShoulder', 'lElbow', 'L'], ['lElbow', 'lWrist', 'L'], ['lShoulder', 'lHip', 'L'], ['lHip', 'lKnee', 'L'], ['lKnee', 'lAnkle', 'L'], ['lAnkle', 'lHeel', 'L'], ['lHeel', 'lFoot', 'L'], ['lAnkle', 'lFoot', 'L'],
  ['rShoulder', 'rElbow', 'R'], ['rElbow', 'rWrist', 'R'], ['rShoulder', 'rHip', 'R'], ['rHip', 'rKnee', 'R'], ['rKnee', 'rAnkle', 'R'], ['rAnkle', 'rHeel', 'R'], ['rHeel', 'rFoot', 'R'], ['rAnkle', 'rFoot', 'R'],
]

/** One video frame: time (s) and [x, y, visibility] for each joint in JOINT_NAMES order (null = not found) */
export interface PoseFrame { t: number; p: ([number, number, number] | null)[] }

export interface Angles {
  lKnee: number | null; rKnee: number | null
  lHip: number | null; rHip: number | null
  lElbow: number | null; rElbow: number | null
  lShoulder: number | null; rShoulder: number | null
  trunk: number | null        // forward lean from vertical, degrees
  lShin: number | null; rShin: number | null // shin lean from vertical
  lAnkle: number | null; rAnkle: number | null // knee-ankle-toe angle
  shTilt: number | null       // shoulder line vs level (degrees)
  hipTilt: number | null      // hip line vs level (degrees)
}

export type AngleKey = keyof Angles
/** Every angle the app can show: name, which side's color, and which body point it sits next to */
export const ANGLE_INFO: Record<AngleKey, { name: string; side: 'L' | 'R' | 'C'; at: JointName | 'midShoulder' | 'midHip' }> = {
  lShoulder: { name: 'Shoulder', side: 'L', at: 'lShoulder' }, rShoulder: { name: 'Shoulder', side: 'R', at: 'rShoulder' },
  lElbow: { name: 'Elbow', side: 'L', at: 'lElbow' }, rElbow: { name: 'Elbow', side: 'R', at: 'rElbow' },
  lHip: { name: 'Hip', side: 'L', at: 'lHip' }, rHip: { name: 'Hip', side: 'R', at: 'rHip' },
  lKnee: { name: 'Knee', side: 'L', at: 'lKnee' }, rKnee: { name: 'Knee', side: 'R', at: 'rKnee' },
  lAnkle: { name: 'Ankle', side: 'L', at: 'lAnkle' }, rAnkle: { name: 'Ankle', side: 'R', at: 'rAnkle' },
  lShin: { name: 'Shin lean', side: 'L', at: 'lKnee' }, rShin: { name: 'Shin lean', side: 'R', at: 'rKnee' },
  trunk: { name: 'Torso lean', side: 'C', at: 'midShoulder' },
  shTilt: { name: 'Shoulder tilt', side: 'C', at: 'midShoulder' },
  hipTilt: { name: 'Hip tilt', side: 'C', at: 'midHip' },
}
export const ANGLE_KEYS = Object.keys(ANGLE_INFO) as AngleKey[]
export const angleLabel = (k: AngleKey) => (ANGLE_INFO[k].side === 'C' ? ANGLE_INFO[k].name : `${ANGLE_INFO[k].side === 'L' ? 'Left' : 'Right'} ${ANGLE_INFO[k].name.toLowerCase()}`)

export interface Rep {
  n: number
  start: number; bottom: number; end: number
  down: number; up: number       // seconds lowering / lifting
  bottomAngle: number            // primary angle at the bottom
  depthOk: boolean | null        // squat side view: hip crease below knee
  kneeCave: boolean | null       // front view: knees closer together than ankles
  lrDiff: number | null          // front view: left vs right knee angle difference
  trunk: number | null
}

export interface AnalysisResult {
  version: 1
  exercise: ExerciseKind
  view: View
  side: 'L' | 'R'
  aspect: number                 // video width / height
  duration: number
  primary: { key: string; label: string }
  reps: Rep[]
  checks: { level: 'ok' | 'warn' | 'info'; text: string }[]
  lowConfidence: number          // share of frames with poorly seen joints (0..1)
}

const MIN_VIS = 0.5

export function pt(f: PoseFrame, j: JointName): { x: number; y: number; v: number } | null {
  const raw = f.p[JOINT_NAMES.indexOf(j)]
  return raw ? { x: raw[0], y: raw[1], v: raw[2] } : null
}

/** Angle at b (degrees) made by a-b-c, using real pixel proportions */
function angle3(a: { x: number; y: number } | null, b: { x: number; y: number } | null, c: { x: number; y: number } | null, aspect: number): number | null {
  if (!a || !b || !c) return null
  const ax = (a.x - b.x) * aspect, ay = a.y - b.y
  const cx = (c.x - b.x) * aspect, cy = c.y - b.y
  const d = Math.hypot(ax, ay) * Math.hypot(cx, cy)
  if (!d) return null
  const cos = Math.max(-1, Math.min(1, (ax * cx + ay * cy) / d))
  return (Math.acos(cos) * 180) / Math.PI
}

/** Lean of the line top->bottom away from vertical (degrees) */
function fromVertical(top: { x: number; y: number } | null, bottom: { x: number; y: number } | null, aspect: number): number | null {
  if (!top || !bottom) return null
  const dx = (top.x - bottom.x) * aspect, dy = bottom.y - top.y
  if (!dx && !dy) return null
  return Math.abs((Math.atan2(dx, dy) * 180) / Math.PI)
}

/** How far the line a-b is from level (0 = perfectly level) */
function fromLevel(a: { x: number; y: number } | null, b: { x: number; y: number } | null, aspect: number): number | null {
  if (!a || !b) return null
  const dx = Math.abs((a.x - b.x) * aspect), dy = Math.abs(a.y - b.y)
  if (dx < 0.01 && dy < 0.01) return null
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

const vis = <T extends { v: number }>(p: T | null): T | null => (p && p.v >= MIN_VIS ? p : null)
const mid = (a: { x: number; y: number } | null, b: { x: number; y: number } | null) => (a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a ?? b)

export function frameAngles(f: PoseFrame, aspect: number): Angles {
  const g = (j: JointName) => vis(pt(f, j))
  return {
    lKnee: angle3(g('lHip'), g('lKnee'), g('lAnkle'), aspect),
    rKnee: angle3(g('rHip'), g('rKnee'), g('rAnkle'), aspect),
    lHip: angle3(g('lShoulder'), g('lHip'), g('lKnee'), aspect),
    rHip: angle3(g('rShoulder'), g('rHip'), g('rKnee'), aspect),
    lElbow: angle3(g('lShoulder'), g('lElbow'), g('lWrist'), aspect),
    rElbow: angle3(g('rShoulder'), g('rElbow'), g('rWrist'), aspect),
    lShoulder: angle3(g('lHip'), g('lShoulder'), g('lElbow'), aspect),
    rShoulder: angle3(g('rHip'), g('rShoulder'), g('rElbow'), aspect),
    trunk: fromVertical(mid(g('lShoulder'), g('rShoulder')), mid(g('lHip'), g('rHip')), aspect),
    lShin: fromVertical(g('lKnee'), g('lAnkle'), aspect),
    rShin: fromVertical(g('rKnee'), g('rAnkle'), aspect),
    lAnkle: angle3(g('lKnee'), g('lAnkle'), g('lFoot'), aspect),
    rAnkle: angle3(g('rKnee'), g('rAnkle'), g('rFoot'), aspect),
    shTilt: fromLevel(g('lShoulder'), g('rShoulder'), aspect),
    hipTilt: fromLevel(g('lHip'), g('rHip'), aspect),
  }
}

/** Which side faces the camera better (side view) */
function betterSide(frames: PoseFrame[]): 'L' | 'R' {
  let l = 0, r = 0
  for (const f of frames) {
    for (const j of ['Hip', 'Knee', 'Ankle', 'Shoulder'] as const) {
      l += pt(f, `l${j}` as JointName)?.v ?? 0
      r += pt(f, `r${j}` as JointName)?.v ?? 0
    }
  }
  return l >= r ? 'L' : 'R'
}

const PRIMARY: Record<ExerciseKind, { joint: 'Knee' | 'Hip' | 'Elbow' | null; label: string }> = {
  squat: { joint: 'Knee', label: 'Knee angle' },
  lunge: { joint: 'Knee', label: 'Front knee angle' },
  hinge: { joint: 'Hip', label: 'Hip angle' },
  press: { joint: 'Elbow', label: 'Elbow angle' },
  pull: { joint: 'Elbow', label: 'Elbow angle' },
  jump: { joint: 'Knee', label: 'Knee angle' },
  sprint: { joint: null, label: 'Angles only' },
  throw: { joint: null, label: 'Angles only' },
  swing: { joint: null, label: 'Angles only' },
  other: { joint: null, label: 'Angles only' },
}

/** The main angle used to find reps for this exercise, per frame */
export function primarySeries(frames: PoseFrame[], angles: Angles[], exercise: ExerciseKind, view: View, side: 'L' | 'R'): (number | null)[] {
  const joint = PRIMARY[exercise].joint
  if (!joint) return angles.map(() => null)
  return angles.map(a => {
    const L = a[`l${joint}` as keyof Angles], R = a[`r${joint}` as keyof Angles]
    if (exercise === 'lunge') return L != null && R != null ? Math.min(L, R) : L ?? R
    if (view === 'front') return L != null && R != null ? (L + R) / 2 : L ?? R
    return side === 'L' ? L ?? R : R ?? L
  })
}

/** Fill short gaps and smooth out jitter */
export function smooth(series: (number | null)[], win = 2): (number | null)[] {
  const filled = [...series]
  for (let i = 0; i < filled.length; i++) {
    if (filled[i] != null) continue
    let a = i - 1; while (a >= 0 && filled[a] == null) a--
    let b = i + 1; while (b < filled.length && series[b] == null) b++
    if (a >= 0 && b < filled.length && b - a <= 6) filled[i] = (filled[a] as number) + ((series[b] as number) - (filled[a] as number)) * ((i - a) / (b - a))
  }
  return filled.map((_, i) => {
    let s = 0, n = 0
    for (let k = i - win; k <= i + win; k++) if (filled[k] != null) { s += filled[k] as number; n++ }
    return n ? s / n : null
  })
}

/** Find reps as dips in the primary angle (top -> bottom -> top) */
export function findReps(times: number[], s: (number | null)[]): { start: number; bottom: number; end: number }[] {
  const vals = s.filter((v): v is number => v != null)
  if (vals.length < 5) return []
  const hi = Math.max(...vals), lo = Math.min(...vals)
  const range = hi - lo
  if (range < 20) return []
  const top = hi - 0.25 * range
  const bottom = lo + 0.4 * range
  const reps: { start: number; bottom: number; end: number }[] = []
  let state: 'up' | 'down' | 'none' = 'none'
  let lastTop = -1, minIdx = -1
  for (let i = 0; i < s.length; i++) {
    const v = s[i]
    if (v == null) continue
    if (v >= top) {
      if (state === 'down' && minIdx >= 0) reps.push({ start: lastTop, bottom: minIdx, end: i })
      state = 'up'; lastTop = i; minIdx = -1
    } else if (v <= bottom && state === 'up') {
      state = 'down'; minIdx = i
    }
    if (state === 'down' && (minIdx < 0 || v < (s[minIdx] as number))) minIdx = i
  }
  // Widen each rep to where the movement really starts and finishes (the peaks around the dip)
  const tol = Math.max(0.5, range * 0.01)
  let prevEnd = 0
  for (const r of reps) {
    let a0 = r.bottom
    while (a0 - 1 >= prevEnd && s[a0 - 1] != null && (s[a0 - 1] as number) >= (s[a0] as number) - tol) a0--
    let b0 = r.bottom
    while (b0 + 1 < s.length && s[b0 + 1] != null && (s[b0 + 1] as number) >= (s[b0] as number) - tol) b0++
    // stop at the top plateau, not after it
    const peakA = s[a0] as number, peakB = s[b0] as number
    while (a0 < r.bottom && (s[a0 + 1] as number) >= peakA - tol) a0++
    while (b0 > r.bottom && (s[b0 - 1] as number) >= peakB - tol) b0--
    r.start = a0
    r.end = b0
    prevEnd = b0
  }
  return reps
}

export function analyze(frames: PoseFrame[], exercise: ExerciseKind, view: View, aspect: number, duration: number): { result: AnalysisResult; angles: Angles[]; primary: (number | null)[] } {
  const angles = frames.map(f => frameAngles(f, aspect))
  const side = betterSide(frames)
  const raw = primarySeries(frames, angles, exercise, view, side)
  const primary = smooth(raw)
  const times = frames.map(f => f.t)
  const found = PRIMARY[exercise].joint ? findReps(times, primary) : []
  const S = side === 'L' ? 'l' : 'r'

  const reps: Rep[] = found.map((r, i) => {
    const f = frames[r.bottom]
    const a = angles[r.bottom]
    const hip = pt(f, `${S}Hip` as JointName), knee = pt(f, `${S}Knee` as JointName)
    let depthOk: boolean | null = null
    if (exercise === 'squat' && view === 'side' && hip && knee && hip.v > 0.4 && knee.v > 0.4) {
      depthOk = false
      for (let k = Math.max(0, r.bottom - 3); k <= Math.min(frames.length - 1, r.bottom + 3); k++) {
        const h = pt(frames[k], `${S}Hip` as JointName), kn = pt(frames[k], `${S}Knee` as JointName)
        if (h && kn && h.y >= kn.y - 0.01) depthOk = true
      }
    }
    let kneeCave: boolean | null = null, lrDiff: number | null = null
    if (view === 'front' && (exercise === 'squat' || exercise === 'lunge' || exercise === 'jump' || exercise === 'hinge')) {
      const lk = pt(f, 'lKnee'), rk = pt(f, 'rKnee'), la = pt(f, 'lAnkle'), ra = pt(f, 'rAnkle')
      if (lk && rk && la && ra && Math.abs(la.x - ra.x) > 0.02) kneeCave = Math.abs(lk.x - rk.x) / Math.abs(la.x - ra.x) < 0.85
      if (a.lKnee != null && a.rKnee != null) lrDiff = Math.round(Math.abs(a.lKnee - a.rKnee))
    }
    return {
      n: i + 1,
      start: times[r.start], bottom: times[r.bottom], end: times[r.end],
      down: +(times[r.bottom] - times[r.start]).toFixed(2),
      up: +(times[r.end] - times[r.bottom]).toFixed(2),
      bottomAngle: Math.round(primary[r.bottom] ?? 0),
      depthOk, kneeCave, lrDiff,
      trunk: a.trunk != null ? Math.round(a.trunk) : null,
    }
  })

  // Overall checks
  const checks: AnalysisResult['checks'] = []
  const low = frames.filter(f => {
    const need: JointName[] = view === 'side' ? [`${S}Hip`, `${S}Knee`, `${S}Ankle`, `${S}Shoulder`] as JointName[] : ['lHip', 'rHip', 'lKnee', 'rKnee']
    return need.some(j => (pt(f, j)?.v ?? 0) < MIN_VIS)
  }).length / Math.max(1, frames.length)

  if (frames.length === 0) checks.push({ level: 'warn', text: 'No body was found. Make sure the whole body is in the video and well lit.' })
  else if (low > 0.35) checks.push({ level: 'warn', text: `Joints were hard to see in ${Math.round(low * 100)}% of the video — numbers may be off. Film closer, in good light, whole body in frame.` })

  if (PRIMARY[exercise].joint) {
    if (reps.length === 0 && frames.length > 0) checks.push({ level: 'info', text: 'No full reps found. Film at least one full rep from start to finish.' })
    else if (reps.length) checks.push({ level: 'ok', text: `${reps.length} rep${reps.length === 1 ? '' : 's'} found.` })
  }
  if (exercise === 'squat' && view === 'side' && reps.length) {
    const shallow = reps.filter(r => r.depthOk === false).map(r => r.n)
    checks.push(shallow.length
      ? { level: 'warn', text: `Hip crease stayed above the knee on rep ${shallow.join(', ')}.` }
      : { level: 'ok', text: 'Depth reached on every rep (hip crease at or below the knee).' })
  }
  if (view === 'front' && reps.length) {
    const cave = reps.filter(r => r.kneeCave).map(r => r.n)
    if (cave.length) checks.push({ level: 'warn', text: `Knees moved inward at the bottom of rep ${cave.join(', ')}.` })
    else if (reps.some(r => r.kneeCave === false)) checks.push({ level: 'ok', text: 'Knees stayed in line with the feet.' })
    const lr = reps.filter(r => (r.lrDiff ?? 0) >= 10)
    if (lr.length) checks.push({ level: 'warn', text: `Left and right knees bent differently (up to ${Math.max(...lr.map(r => r.lrDiff ?? 0))}°) — check for shifting to one side.` })
  }
  if (reps.length >= 3) {
    const downs = reps.map(r => r.down)
    const first = downs[0], last = downs[downs.length - 1]
    if (first > 0 && last < first * 0.6) checks.push({ level: 'info', text: `Lowering got faster: ${first}s on rep 1 → ${last}s on rep ${reps.length}.` })
    const depths = reps.map(r => r.bottomAngle)
    if (Math.max(...depths) - Math.min(...depths) >= 15) checks.push({ level: 'info', text: `Range of motion changed by ${Math.max(...depths) - Math.min(...depths)}° between reps.` })
  }
  if (view === 'side' && exercise === 'squat' && reps.length) {
    const maxLean = Math.max(...reps.map(r => r.trunk ?? 0))
    if (maxLean >= 50) checks.push({ level: 'info', text: `Torso leaned forward up to ${maxLean}° at the bottom.` })
  }
  if (!PRIMARY[exercise].joint) checks.push({ level: 'info', text: 'Rep counting is for lifts. Use slow motion, the markers and the angle list below to review this movement.' })

  return {
    result: {
      version: 1, exercise, view, side, aspect, duration,
      primary: { key: PRIMARY[exercise].joint ?? 'none', label: PRIMARY[exercise].label },
      reps, checks, lowConfidence: +low.toFixed(2),
    },
    angles,
    primary,
  }
}

/** Guess the exercise from a message like "🎥 Form check — Back Squat" */
export function guessExercise(text: string): ExerciseKind {
  const t = text.toLowerCase()
  if (/lunge|split squat|rfess|bulgarian|step.?up/.test(t)) return 'lunge'
  if (/squat|goblet/.test(t)) return 'squat'
  if (/(kettlebell|kb|russian|american) swing/.test(t)) return 'hinge'
  if (/swing|batting|hitting|\bbat\b|golf|tee work|\bhit\b/.test(t)) return 'swing'
  if (/deadlift|rdl|hinge|good morning|hip thrust|clean pull/.test(t)) return 'hinge'
  if (/bench|press|push.?up|dip/.test(t)) return 'press'
  if (/row|pull.?up|chin.?up|pulldown/.test(t)) return 'pull'
  if (/jump|hop|bound|depth drop|landing/.test(t)) return 'jump'
  if (/sprint|start|accel|dash|fly/.test(t)) return 'sprint'
  if (/throw|pitch|long toss/.test(t)) return 'throw'
  return 'other'
}
