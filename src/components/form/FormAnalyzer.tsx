'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Play, Pause, ChevronLeft, ChevronRight, Activity, CheckCircle2, AlertTriangle, Info, RefreshCw, Camera, SlidersHorizontal, Pencil, Minus, ArrowUpRight, Circle, Triangle, Undo2, Trash2, Send, MessageSquareText, ZoomIn, ZoomOut, Crosshair, EyeOff, RotateCcw, Move, Box } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { saveVideoAnalysis, saveVideoNotes, sendVideoReview } from '@/app/actions/videoAnalysis'
import { drawStroke, notesAt, PEN_COLORS, POINT_COLORS, POINT_IDEAS, parseAnnotations, pointAt, setKey, type CustomAngle, type CustomPoint, type Stroke, type Tool, type VideoNote } from '@/lib/pose/annotations'
import type { Message } from '@/types'
import { extractPose, loadPoseEngine } from '@/lib/pose/engine'
import {
  analyze, frameAngles, pt, wpt, angle3D, has3D, BONES, EXERCISE_LABEL, guessExercise, ANGLE_INFO, ANGLE_KEYS, angleLabel, JOINT_NAMES,
  type AnalysisResult, type Angles, type AngleKey, type ExerciseKind, type JointName, type PoseFrame, type View,
} from '@/lib/pose/analysis'
import { cn } from '@/lib/utils'

const COLORS = { L: '#f97316', R: '#38bdf8', C: '#e4e4e7' } // left orange, right blue (like the chart)
const SPEEDS = [1, 0.5, 0.25]

const TIPS: Record<View, string> = {
  side: 'Side view: phone at hip height, 10–15 ft away, whole body in frame, camera still. Best for depth, hip and knee angles, torso lean and tempo.',
  front: 'Front view: phone at hip height straight in front, whole body in frame. Best for knees caving in and left vs right differences.',
}

/** Angles turned on at first for each exercise (you can turn any of them on or off) */
const LABELS: Record<ExerciseKind, AngleKey[]> = {
  squat: ['lKnee', 'rKnee', 'lHip', 'rHip', 'trunk'],
  lunge: ['lKnee', 'rKnee', 'lHip', 'rHip', 'trunk'],
  hinge: ['lHip', 'rHip', 'lKnee', 'rKnee', 'trunk'],
  jump: ['lKnee', 'rKnee', 'lHip', 'rHip'],
  press: ['lElbow', 'rElbow', 'lShoulder', 'rShoulder'],
  pull: ['lElbow', 'rElbow', 'lShoulder', 'rShoulder', 'trunk'],
  sprint: ['lKnee', 'rKnee', 'lHip', 'rHip', 'lShin', 'rShin', 'trunk'],
  throw: ['lElbow', 'rElbow', 'lShoulder', 'rShoulder', 'lKnee', 'rKnee', 'shTilt'],
  swing: ['lElbow', 'rElbow', 'lKnee', 'rKnee', 'trunk', 'shTilt', 'hipTilt'],
  other: ['lKnee', 'rKnee', 'lHip', 'rHip', 'lElbow', 'rElbow', 'trunk'],
}
function defaultShown(ex: ExerciseKind, view: View, side: 'L' | 'R' | undefined): Set<AngleKey> {
  // Side view: only the side closest to the camera at first (the far side is usually hidden)
  return new Set(LABELS[ex].filter(k => view === 'front' || !side || ANGLE_INFO[k].side === 'C' || ANGLE_INFO[k].side === side))
}
/** Tapping a body point turns on/off the angle that lives there */
const JOINT_ANGLE: Partial<Record<JointName, AngleKey>> = {
  nose: 'trunk', lShoulder: 'lShoulder', rShoulder: 'rShoulder', lElbow: 'lElbow', rElbow: 'rElbow', lWrist: 'lElbow', rWrist: 'rElbow',
  lHip: 'lHip', rHip: 'rHip', lKnee: 'lKnee', rKnee: 'rKnee', lAnkle: 'lAnkle', rAnkle: 'rAnkle', lHeel: 'lAnkle', rHeel: 'rAnkle', lFoot: 'lAnkle', rFoot: 'rAnkle', lHand: 'lWrist', rHand: 'rWrist',
}
const JOINT_LABEL: Record<JointName, string> = {
  nose: 'Head', lShoulder: 'Left shoulder', rShoulder: 'Right shoulder', lElbow: 'Left elbow', rElbow: 'Right elbow',
  lWrist: 'Left wrist', rWrist: 'Right wrist', lHand: 'Left hand', rHand: 'Right hand', lHip: 'Left hip', rHip: 'Right hip',
  lKnee: 'Left knee', rKnee: 'Right knee', lAnkle: 'Left ankle', rAnkle: 'Right ankle', lHeel: 'Left heel', rHeel: 'Right heel',
  lFoot: 'Left toe', rFoot: 'Right toe',
}
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
type TapMenu = { x: number; y: number; joint?: JointName; point?: string } | null

/** Blend the two stored frames around time t so the skeleton moves smoothly */
function frameAt(frames: PoseFrame[], t: number): PoseFrame | null {
  if (!frames.length) return null
  let lo = 0, hi = frames.length - 1
  if (t <= frames[0].t) return frames[0]
  if (t >= frames[hi].t) return frames[hi]
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (frames[m].t <= t) lo = m; else hi = m }
  const a = frames[lo], b = frames[hi]
  const k = (t - a.t) / Math.max(1e-6, b.t - a.t)
  return {
    t,
    p: a.p.map((pa, i) => {
      const pb = b.p[i]
      if (!pa || !pb) return pa ?? pb
      return [pa[0] + (pb[0] - pa[0]) * k, pa[1] + (pb[1] - pa[1]) * k, Math.min(pa[2], pb[2])] as [number, number, number]
    }),
    w: a.w && b.w ? a.w.map((wa, i) => {
      const wb = b.w![i]
      if (!wa || !wb) return wa ?? wb ?? null
      return [wa[0] + (wb[0] - wa[0]) * k, wa[1] + (wb[1] - wa[1]) * k, wa[2] + (wb[2] - wa[2]) * k] as [number, number, number]
    }) : a.w,
  }
}
const ANGLE_COLORS = ['#facc15', '#f472b6', '#4ade80', '#60a5fa', '#fb923c']

export function FormAnalyzer({ src, path, title, canSave, onClose, onSent }: {
  src: string
  path: string
  title: string
  canSave: boolean
  onClose: () => void
  onSent?: (m: Message) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const [exercise, setExercise] = useState<ExerciseKind>(() => guessExercise(title))
  const [view, setView] = useState<View>('side')
  const [phase, setPhase] = useState<'checking' | 'setup' | 'analyzing' | 'ready'>('checking')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [frames, setFrames] = useState<PoseFrame[]>([])
  const [aspect, setAspect] = useState(9 / 16)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [time, setTime] = useState(0)
  const [saved, setSaved] = useState(false)
  const [shown, setShown] = useState<Set<AngleKey>>(() => defaultShown(guessExercise(title), 'side', undefined))
  const [showBones, setShowBones] = useState(true)
  const [showPoints, setShowPoints] = useState(true)
  const [graphKey, setGraphKey] = useState<'auto' | AngleKey>('auto')
  const [flash, setFlash] = useState('')
  // Drawings + notes
  const [notes, setNotes] = useState<VideoNote[]>([])
  const notesRef = useRef<VideoNote[]>([])
  notesRef.current = notes
  const [drawMode, setDrawMode] = useState(false)
  const drawModeRef = useRef(false)
  drawModeRef.current = drawMode
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(PEN_COLORS[0])
  const draft = useRef<Stroke[]>([])
  const inProgress = useRef<Stroke | null>(null)
  const [draftVer, setDraftVer] = useState(0)
  const [noteText, setNoteText] = useState('')
  const [pauseAtNotes, setPauseAtNotes] = useState(true)
  const pauseRef = useRef(true)
  pauseRef.current = pauseAtNotes
  const [notesMsg, setNotesMsg] = useState('')
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sentOk, setSentOk] = useState(false)
  // Your own points + body points you removed
  const [points, setPoints] = useState<CustomPoint[]>([])
  const pointsRef = useRef<CustomPoint[]>([])
  pointsRef.current = points
  const [hidden, setHidden] = useState<Set<JointName>>(new Set())
  const [placing, setPlacing] = useState<string | null>(null)
  const placingRef = useRef<string | null>(null)
  placingRef.current = placing
  const [menu, setMenu] = useState<TapMenu>(null)
  const [angles, setAngles] = useState<CustomAngle[]>([])
  const anglesRef = useRef<CustomAngle[]>([])
  anglesRef.current = angles
  const [picking, setPicking] = useState<string[] | null>(null) // building a custom angle: refs tapped so far
  const pickingRef = useRef<string[] | null>(null)
  pickingRef.current = picking
  const [fixing, setFixing] = useState<JointName | null>(null)   // moving a body point on this frame
  const [use3d, setUse3d] = useState(true)
  const use3dRef = useRef(true)
  use3dRef.current = use3d
  const [best, setBest] = useState(true)
  const loadedNotes = useRef(false)
  const lastSaved = useRef('')
  // Zoom: scale + offset of the video inside its box
  const zoomRef = useRef({ z: 1, tx: 0, ty: 0 })
  const [zoom, setZoomState] = useState(1)
  const gesture = useRef<{ ptrs: Map<number, { x: number; y: number }>; moved: number; pinch: { d: number; z: number } | null }>({ ptrs: new Map(), moved: 0, pinch: null })
  const stageRef = useRef<HTMLDivElement>(null)
  const cancel = useRef({ cancelled: false })

  // Saved results from an earlier run?
  useEffect(() => {
    let alive = true
    createClient()
      .from('video_analyses')
      .select('exercise, view, result, frames, annotations')
      .eq('video_path', path)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        const ann = parseAnnotations(data?.annotations)
        const saved = [...ann.notes, ...ann.points]
        setNotes(ann.notes); setPoints(ann.points); setHidden(new Set(ann.hidden as JointName[])); setAngles(ann.angles ?? [])
        lastSaved.current = JSON.stringify({ v: 2, notes: ann.notes, points: ann.points, hidden: ann.hidden, angles: ann.angles ?? [] })
        loadedNotes.current = true
        if (data?.frames?.length) {
          setExercise(data.exercise as ExerciseKind)
          setView(data.view as View)
          setFrames(data.frames as PoseFrame[])
          if ((data.result as AnalysisResult)?.aspect) setAspect((data.result as AnalysisResult).aspect)
          setSaved(true)
          setPhase('ready')
        } else if (saved.length) {
          setPhase('ready') // drawings/notes without body tracking
        } else {
          setPhase('setup')
          loadPoseEngine().catch(() => {}) // warm up while they pick options
        }
      })
    return () => { alive = false; cancel.current.cancelled = true }
  }, [path])

  const analysis = useMemo(
    () => (frames.length ? analyze(frames, exercise, view, aspect, duration || frames[frames.length - 1].t, use3d) : null),
    [frames, exercise, view, aspect, duration, use3d]
  )

  // New exercise / camera view -> start from that exercise's usual markers
  const side = analysis?.result.side
  const is3D = useMemo(() => has3D(frames), [frames])
  useEffect(() => { setShown(defaultShown(exercise, view, side)); setGraphKey('auto') }, [exercise, view, side])

  function toggleAngle(k: AngleKey) {
    setShown(prev => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k); else n.add(k)
      setFlash(`${angleLabel(k)} ${n.has(k) ? 'on' : 'off'}`)
      return n
    })
  }
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(''), 1200); return () => clearTimeout(t) }, [flash])

  /** Where the video sits inside the box (it's letterboxed) */
  function videoRect() {
    const video = videoRef.current, box = boxRef.current
    if (!video || !box) return null
    const W = box.clientWidth, H = box.clientHeight
    const va = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : aspect
    let dw = W, dh = W / va
    if (dh > H) { dh = H; dw = H * va }
    const { z, tx, ty } = zoomRef.current
    return { W, H, dw: dw * z, dh: dh * z, ox: tx + ((W - dw) / 2) * z, oy: ty + ((H - dh) / 2) * z, va }
  }

  // ---------- Zoom + pan ----------
  function applyZoom(z: number, tx: number, ty: number) {
    const box = boxRef.current
    const W = box?.clientWidth ?? 0, H = box?.clientHeight ?? 0
    z = Math.max(1, Math.min(6, z))
    tx = Math.min(0, Math.max(W - W * z, tx))
    ty = Math.min(0, Math.max(H - H * z, ty))
    zoomRef.current = { z, tx, ty }
    if (stageRef.current) stageRef.current.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`
    setZoomState(z)
  }
  /** Zoom to z keeping the spot (cx, cy) in the box under the finger */
  function zoomAt(z: number, cx: number, cy: number) {
    const o = zoomRef.current
    const nz = Math.max(1, Math.min(6, z))
    applyZoom(nz, cx - (cx - o.tx) * (nz / o.z), cy - (cy - o.ty) * (nz / o.z))
  }
  function zoomBy(f: number) {
    const box = boxRef.current; if (!box) return
    zoomAt(zoomRef.current.z * f, box.clientWidth / 2, box.clientHeight / 2)
  }
  function local(e: { clientX: number; clientY: number }) {
    const b = boxRef.current!.getBoundingClientRect()
    return { x: e.clientX - b.left, y: e.clientY - b.top }
  }
  function onBoxPointerDown(e: React.PointerEvent) {
    const g = gesture.current
    g.ptrs.set(e.pointerId, local(e))
    if (g.ptrs.size === 1) g.moved = 0
    if (g.ptrs.size === 2) {
      const [a, b] = Array.from(g.ptrs.values())
      g.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoomRef.current.z }
      inProgress.current = null // two fingers = zoom, not draw
    }
  }
  function onBoxPointerMove(e: React.PointerEvent) {
    const g = gesture.current
    const prev = g.ptrs.get(e.pointerId)
    if (!prev) return
    const p = local(e)
    g.ptrs.set(e.pointerId, p)
    if (g.ptrs.size >= 2 && g.pinch) {
      const [a, b] = Array.from(g.ptrs.values())
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      zoomAt(g.pinch.z * (d / Math.max(1, g.pinch.d)), (a.x + b.x) / 2, (a.y + b.y) / 2)
      g.moved += 10
      return
    }
    if (drawModeRef.current || zoomRef.current.z <= 1) return
    const dx = p.x - prev.x, dy = p.y - prev.y
    g.moved += Math.abs(dx) + Math.abs(dy)
    const o = zoomRef.current
    applyZoom(o.z, o.tx + dx, o.ty + dy)
  }
  function onBoxPointerUp(e: React.PointerEvent) {
    const g = gesture.current
    g.ptrs.delete(e.pointerId)
    if (g.ptrs.size < 2) g.pinch = null
  }
  useEffect(() => { if (phase === 'ready') applyZoom(1, 0, 0) }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps
  // Mouse wheel / trackpad pinch zooms (needs a non-passive listener to stop the page scrolling)
  useEffect(() => {
    const box = boxRef.current
    if (phase !== 'ready' || !box) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const b = box.getBoundingClientRect()
      zoomAt(zoomRef.current.z * Math.exp(-e.deltaY * 0.0025), e.clientX - b.left, e.clientY - b.top)
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ---------- References to points ('joint:rElbow' or 'pt:<id>') ----------
  function refPos(ref: string, f: PoseFrame | null, t: number): { x: number; y: number } | null {
    if (ref.startsWith('joint:')) {
      const j = ref.slice(6) as JointName
      if (!f || hidden.has(j)) return null
      const q = pt(f, j)
      return q && q.v >= 0.35 ? { x: q.x, y: q.y } : null
    }
    const other = pointsRef.current.find(p => p.id === ref.slice(3))
    return other ? pointAt(other, t) : null
  }
  /** Angle at the middle point. Uses 3D when all three are body points and 3D is on. */
  function refAngle(refs: string[], f: PoseFrame | null, va: number, t: number): { v: number; d3: boolean } | null {
    if (use3dRef.current && f?.w && refs.every(x => x.startsWith('joint:'))) {
      const [a, b, c] = refs.map(x => wpt(f, x.slice(6) as JointName))
      const v = angle3D(a, b, c)
      if (v != null) return { v, d3: true }
    }
    const [a, b, c] = refs.map(x => refPos(x, f, t))
    if (!a || !b || !c) return null
    const ax = (a.x - b.x) * va, ay = a.y - b.y, cx = (c.x - b.x) * va, cy = c.y - b.y
    const d = Math.hypot(ax, ay) * Math.hypot(cx, cy)
    if (!d) return null
    return { v: (Math.acos(Math.max(-1, Math.min(1, (ax * cx + ay * cy) / d))) * 180) / Math.PI, d3: false }
  }
  /** A drawn angle whose 3 taps all snapped to body points -> its real 3D angle at that moment */
  function stroke3D(s: Stroke, t: number): number | null {
    if (!use3dRef.current || !s.refs || s.refs.length < 3 || s.refs.some(x => !x || !x.startsWith('joint:'))) return null
    const f = frameAt(frames, t)
    if (!f?.w) return null
    const [a, b, c] = s.refs.slice(0, 3).map(x => wpt(f, x!.slice(6) as JointName))
    return angle3D(a, b, c)
  }
  /** Closest body point or your point to a spot on screen (within `max` px) */
  function nearestRef(x: number, y: number, max = 30): string | null {
    const r = videoRect(), video = videoRef.current
    if (!r || !video) return null
    const t = video.currentTime
    let best: string | null = null, bestD = max
    for (const p of pointsRef.current) {
      const q = pointAt(p, t); if (!q) continue
      const d = Math.hypot(r.ox + q.x * r.dw - x, r.oy + q.y * r.dh - y)
      if (d < bestD) { bestD = d; best = `pt:${p.id}` }
    }
    const f = frameAt(frames, t)
    if (f) {
      for (const j of JOINT_NAMES) {
        if (hidden.has(j)) continue
        const q = pt(f, j); if (!q || q.v < 0.35) continue
        const d = Math.hypot(r.ox + q.x * r.dw - x, r.oy + q.y * r.dh - y)
        if (d < bestD) { bestD = d; best = `joint:${j}` }
      }
    }
    return best
  }
  const refName = (ref: string) => ref.startsWith('joint:') ? JOINT_LABEL[ref.slice(6) as JointName] : points.find(p => p.id === ref.slice(3))?.name ?? 'Point'
  function startAngle() {
    videoRef.current?.pause(); setPlaying(false)
    setPlacing(null); setFixing(null); setDrawMode(false); setPicking([])
  }

  // ---------- Points ----------
  function addPoint(name: string) {
    const p: CustomPoint = { id: newId(), name, color: POINT_COLORS[points.length % POINT_COLORS.length], keys: [], link: /bat|club|racket/i.test(name) && frames.length ? 'joint:rHand' : null }
    setPoints(ps => [...ps, p])
    videoRef.current?.pause(); setPlaying(false)
    setPlacing(p.id)
    setDrawMode(false)
  }
  function updatePoint(id: string, fn: (p: CustomPoint) => CustomPoint) {
    setPoints(ps => ps.map(p => (p.id === id ? fn(p) : p)))
  }
  function removeJoint(j: JointName) { setHidden(h => new Set(h).add(j)); setFlash(`${JOINT_LABEL[j]} removed`) }
  function restoreJoint(j: JointName) { setHidden(h => { const n = new Set(h); n.delete(j); return n }) }
  function linkPos(link: string | null, f: PoseFrame | null, t: number) {
    if (!link) return null
    if (link.startsWith('joint:')) {
      const j = link.slice(6) as JointName
      if (!f || hidden.has(j)) return null
      const q = pt(f, j)
      return q && q.v >= 0.35 ? { x: q.x, y: q.y } : null
    }
    const other = pointsRef.current.find(p => p.id === link.slice(3))
    return other ? pointAt(other, t) : null
  }

  /** Tap: place a point (when placing), open the menu for a body/your point, otherwise play/pause */
  function onBoxTap(e: React.MouseEvent<HTMLDivElement>) {
    if (drawModeRef.current) return
    if (gesture.current.moved > 8) { gesture.current.moved = 0; return } // that was a drag/zoom
    const r = videoRect(), video = videoRef.current, box = boxRef.current
    if (!r || !video || !box) return
    const { x, y } = local(e)
    const t = video.currentTime
    if (menu) { setMenu(null); return }
    if (pickingRef.current) {
      const ref = nearestRef(x, y, 40)
      if (!ref) { setFlash('Tap right on a point'); return }
      if (pickingRef.current.includes(ref)) { setFlash('Pick a different point'); return }
      const next = [...pickingRef.current, ref]
      if (next.length === 3) {
        setAngles(as => [...as, { id: newId(), refs: next as [string, string, string], color: ANGLE_COLORS[as.length % ANGLE_COLORS.length] }])
        setPicking(null)
        setFlash('Angle added')
      } else setPicking(next)
      return
    }
    if (fixing) {
      const nx = (x - r.ox) / r.dw, ny = (y - r.oy) / r.dh
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return
      const ji = JOINT_NAMES.indexOf(fixing)
      setFrames(fs => {
        if (!fs.length) return fs
        let k = 0
        for (let i = 1; i < fs.length; i++) if (Math.abs(fs[i].t - t) < Math.abs(fs[k].t - t)) k = i
        const copy = fs.slice()
        const fr = { ...copy[k], p: copy[k].p.slice(), w: copy[k].w?.slice() }
        fr.p[ji] = [Math.round(nx * 1000) / 1000, Math.round(ny * 1000) / 1000, 1]
        if (fr.w) fr.w[ji] = null // 3D for this spot isn't known any more — that frame uses the flat angle
        copy[k] = fr
        return copy
      })
      setFlash(`${JOINT_LABEL[fixing]} moved on this frame`)
      return
    }
    if (placingRef.current) {
      const nx = (x - r.ox) / r.dw, ny = (y - r.oy) / r.dh
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return
      updatePoint(placingRef.current, p => setKey(p, t, nx, ny))
      return
    }
    // Your points first, then body points
    let bestD = 28
    let hit: TapMenu = null
    for (const p of points) {
      const q = pointAt(p, t); if (!q) continue
      const d = Math.hypot(r.ox + q.x * r.dw - x, r.oy + q.y * r.dh - y)
      if (d < bestD) { bestD = d; hit = { x, y, point: p.id } }
    }
    const f = frameAt(frames, t)
    if (f && showPoints) {
      for (const j of JOINT_NAMES) {
        if (hidden.has(j)) continue
        const q = pt(f, j)
        if (!q || q.v < 0.35) continue
        const d = Math.hypot(r.ox + q.x * r.dw - x, r.oy + q.y * r.dh - y)
        if (d < bestD) { bestD = d; hit = { x, y, joint: j } }
      }
    }
    if (hit) { video.pause(); setPlaying(false); setMenu(hit) }
    else togglePlay()
  }

  // Save whenever the results change (new run, or a different exercise / view picked)
  useEffect(() => {
    if (!analysis || !canSave || phase !== 'ready') return
    const t = setTimeout(() => {
      saveVideoAnalysis(path, analysis.result, frames).then(r => setSaved(!(r && 'error' in r && r.error)))
    }, 600)
    return () => clearTimeout(t)
  }, [analysis, canSave, phase, path, frames])

  async function run() {
    setError(''); setPhase('analyzing'); setProgress(0)
    cancel.current = { cancelled: false }
    try {
      const v = document.createElement('video')
      v.crossOrigin = 'anonymous'
      v.muted = true
      v.playsInline = true
      v.preload = 'auto'
      v.src = src
      await new Promise<void>((res, rej) => {
        v.onloadeddata = () => res()
        v.onerror = () => rej(new Error('Could not open the video.'))
        setTimeout(() => rej(new Error('The video took too long to load.')), 30000)
      })
      setAspect(v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 9 / 16)
      setDuration(v.duration)
      // Best: every frame (30/s) with the bigger model — follows fast swings much better
      const fps = best ? (v.duration > 30 ? 10 : v.duration > 15 ? 15 : 30) : (v.duration > 40 ? 8 : v.duration > 20 ? 10 : 15)
      const out = await extractPose(v, { fps, best, onProgress: setProgress, signal: cancel.current })
      if (cancel.current.cancelled) return
      setFrames(out)
      setPhase('ready')
    } catch (e) {
      setError((e as Error).message || 'Something went wrong analyzing this video.')
      setPhase('setup')
    }
  }

  // ---------- Drawing ----------
  const draw = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current, box = boxRef.current
    if (!video || !canvas || !box) return
    const W = box.clientWidth, H = box.clientHeight
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr; canvas.height = H * dpr
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`
    }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const r = videoRect()
    if (!r) return
    const { va, dw, dh, ox, oy } = r
    const f = frameAt(frames, video.currentTime)
    if (f) {
    const P = (j: JointName) => {
      if (hidden.has(j)) return null
      const p = pt(f, j)
      return p && p.v >= 0.35 ? { x: ox + p.x * dw, y: oy + p.y * dh, v: p.v } : null
    }
    ctx.lineCap = 'round'
    for (const [a, b, side] of showBones ? BONES : []) {
      const A = P(a), B = P(b)
      if (!A || !B) continue
      ctx.strokeStyle = COLORS[side]
      ctx.globalAlpha = Math.min(1, (A.v + B.v) / 1.4)
      ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke()
    }
    ctx.globalAlpha = 1
    const ringed = new Set<JointName>()
    for (const k of Array.from(shown)) { const at = ANGLE_INFO[k].at; if (at !== 'midShoulder' && at !== 'midHip') ringed.add(at) }
    const dots = new Map<JointName, 'L' | 'R' | 'C'>()
    for (const [a, b, sd] of BONES) { if (!dots.has(a)) dots.set(a, sd); if (!dots.has(b)) dots.set(b, sd) }
    dots.set('nose', 'C')
    for (const [a, side] of showPoints ? Array.from(dots.entries()) : []) {
      const A = P(a)
      if (!A) continue
      if (ringed.has(a)) { ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(A.x, A.y, 9, 0, Math.PI * 2); ctx.stroke() }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(A.x, A.y, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = side === 'C' && a === 'nose' ? '#e4e4e7' : COLORS[side === 'C' ? (a.startsWith('l') ? 'L' : 'R') : side]
      ctx.beginPath(); ctx.arc(A.x, A.y, 3.2, 0, Math.PI * 2); ctx.fill()
    }
    // Angle labels next to the joints
    const ang = frameAngles(hidden.size ? { t: f.t, p: f.p.map((q, i) => (hidden.has(JOINT_NAMES[i]) ? null : q)), w: f.w } : f, va, use3dRef.current)
    ctx.font = '600 12px Inter, system-ui, sans-serif'
    for (const key of ANGLE_KEYS) {
      if (!shown.has(key)) continue
      const val = ang[key]
      if (val == null) continue
      const info = ANGLE_INFO[key]
      let x: number, y: number
      if (info.at === 'midShoulder' || info.at === 'midHip') {
        const a = P(info.at === 'midShoulder' ? 'lShoulder' : 'lHip'), b = P(info.at === 'midShoulder' ? 'rShoulder' : 'rHip')
        const m = a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a ?? b
        if (!m) continue
        x = m.x; y = m.y + (key === 'trunk' ? -22 : key === 'shTilt' ? -40 : 28)
      } else {
        const j = P(info.at); if (!j) continue
        x = j.x + (info.side === 'L' ? 12 : -12); y = j.y + (key === 'lShin' || key === 'rShin' ? 18 : key === 'lAnkle' || key === 'rAnkle' ? 20 : -8)
      }
      const text = `${info.name} ${Math.round(val)}°`
      const w = ctx.measureText(text).width + 10
      const left = info.side === 'C' ? x - w / 2 : info.side === 'R' ? x - w : x
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillRect(left, y - 13, w, 18)
      ctx.fillStyle = info.side === 'C' ? '#e4e4e7' : COLORS[info.side]
      ctx.fillText(text, left + 5, y)
    }
    }
    // Coach drawings: the draft while drawing, otherwise the notes at this moment
    const strokes: { s: Stroke; t: number }[] = drawModeRef.current
      ? [...draft.current, ...(inProgress.current ? [inProgress.current] : [])].map(s => ({ s, t: video.currentTime }))
      : notesAt(notesRef.current, video.currentTime).flatMap(n => n.strokes.map(s => ({ s, t: n.t })))
    for (const { s, t: st } of strokes) drawStroke(ctx, s, r, s.tool === 'angle' && s.pts.length >= 3 ? stroke3D(s, st) : null)

    // Your 3-point angles, followed through the video
    for (const a of anglesRef.current) {
      const P3 = a.refs.map(ref => refPos(ref, f, video.currentTime))
      if (P3.some(q => !q)) continue
      const S = P3.map(q => ({ x: r.ox + q!.x * r.dw, y: r.oy + q!.y * r.dh }))
      ctx.save()
      ctx.strokeStyle = a.color; ctx.lineWidth = 3; ctx.setLineDash([7, 5]); ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(S[0].x, S[0].y); ctx.lineTo(S[1].x, S[1].y); ctx.lineTo(S[2].x, S[2].y); ctx.stroke()
      ctx.setLineDash([])
      const deg = refAngle(a.refs, f, va, video.currentTime)
      if (deg) {
        const text = `${Math.round(deg.v)}°${deg.d3 ? ' 3D' : ''}`
        ctx.font = '700 14px Inter, system-ui, sans-serif'
        const w = ctx.measureText(text).width + 12
        ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(S[1].x + 10, S[1].y + 6, w, 22)
        ctx.fillStyle = a.color; ctx.fillText(text, S[1].x + 16, S[1].y + 22)
      }
      ctx.restore()
    }
    // Points tapped so far while building an angle
    for (const ref of pickingRef.current ?? []) {
      const q = refPos(ref, f, video.currentTime); if (!q) continue
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(r.ox + q.x * r.dw, r.oy + q.y * r.dh, 13, 0, Math.PI * 2); ctx.stroke()
    }

    // Your points (bat, ball…) with an optional line + angle to another point
    const t = video.currentTime
    ctx.font = '600 12px Inter, system-ui, sans-serif'
    for (const p of pointsRef.current) {
      const q = pointAt(p, t)
      const isPlacing = placingRef.current === p.id
      if (!q) continue
      const X = r.ox + q.x * r.dw, Y = r.oy + q.y * r.dh
      const o = linkPos(p.link, f, t)
      if (o) {
        const OX = r.ox + o.x * r.dw, OY = r.oy + o.y * r.dh
        ctx.strokeStyle = p.color; ctx.lineWidth = 3.5; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(OX, OY); ctx.lineTo(X, Y); ctx.stroke()
        const dx = (q.x - o.x) * va, dy = q.y - o.y
        const deg = Math.round((Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI)
        const text = `${p.name} ${deg}° ${dy > 0.002 ? 'below' : dy < -0.002 ? 'above' : ''} level`.replace('  ', ' ')
        const w = ctx.measureText(text).width + 10
        const lx = (X + OX) / 2 - w / 2, ly = (Y + OY) / 2 - 10
        ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(lx, ly - 13, w, 18)
        ctx.fillStyle = p.color; ctx.fillText(text, lx + 5, ly)
      }
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(X, Y, 7, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(X, Y, 5, 0, Math.PI * 2); ctx.fill()
      if (isPlacing) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, 12, 0, Math.PI * 2); ctx.stroke() }
      if (!o) {
        const w = ctx.measureText(p.name).width + 8
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(X + 10, Y - 20, w, 16)
        ctx.fillStyle = p.color; ctx.fillText(p.name, X + 14, Y - 8)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, aspect, shown, showBones, showPoints, hidden])

  useEffect(() => {
    if (phase !== 'ready') return
    let raf = 0
    let last = -1
    let prev = -1
    const loop = () => {
      draw()
      const el = videoRef.current
      const ct = el?.currentTime ?? 0
      // Stop on each note so it can be read
      if (el && !el.paused && pauseRef.current && prev >= 0 && ct > prev) {
        const hit = notesRef.current.find(n => n.t > prev && n.t <= ct)
        if (hit) { el.pause(); el.currentTime = hit.t; setPlaying(false) }
      }
      prev = el?.currentTime ?? ct
      if (Math.abs(ct - last) > 0.03) { last = ct; setTime(ct) }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase, draw])

  // ---------- Drawing + notes ----------
  function toNorm(e: React.PointerEvent): [number, number] | null {
    const r = videoRect(), box = boxRef.current
    if (!r || !box) return null
    const b = box.getBoundingClientRect()
    return [(e.clientX - b.left - r.ox) / r.dw, (e.clientY - b.top - r.oy) / r.dh]
  }
  /** Snap a tap onto a nearby body point / your point (so angles and lines land exactly on the joint) */
  function snap(e: React.PointerEvent, p: [number, number]): { p: [number, number]; ref: string | null } {
    const { x, y } = local(e)
    const ref = nearestRef(x, y, 26)
    const t = videoRef.current?.currentTime ?? 0
    const q = ref ? refPos(ref, frameAt(frames, t), t) : null
    return q ? { p: [q.x, q.y], ref } : { p, ref: null }
  }
  function penDown(e: React.PointerEvent) {
    e.preventDefault()
    const raw = toNorm(e); if (!raw) return
    const snapped = tool === 'angle' || tool === 'line' || tool === 'arrow' ? snap(e, raw) : { p: raw, ref: null }
    const p = snapped.p
    if (tool === 'angle') {
      const cur = inProgress.current
      if (cur && cur.tool === 'angle' && cur.pts.length < 3) { cur.pts.push(p); cur.refs = [...(cur.refs ?? []), snapped.ref] }
      else inProgress.current = { tool: 'angle', color, pts: [p], refs: [snapped.ref] }
      if (inProgress.current!.pts.length === 3) { draft.current.push(inProgress.current!); inProgress.current = null }
      setDraftVer(v => v + 1)
      return
    }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    inProgress.current = { tool, color, pts: [p] }
  }
  function penMove(e: React.PointerEvent) {
    const cur = inProgress.current
    if (!cur || cur.tool === 'angle') return
    const p = toNorm(e); if (!p) return
    if (cur.tool === 'pen') cur.pts.push(p)
    else cur.pts = [cur.pts[0], cur.tool === 'circle' ? p : snap(e, p).p]
  }
  function penUp() {
    const cur = inProgress.current
    if (!cur || cur.tool === 'angle') return
    if (cur.tool === 'pen' || cur.pts.length >= 2) draft.current.push(cur)
    inProgress.current = null
    setDraftVer(v => v + 1)
  }
  function startDrawing() {
    videoRef.current?.pause(); setPlaying(false)
    draft.current = []; inProgress.current = null; setNoteText(''); setDrawMode(true); setDraftVer(v => v + 1)
  }
  function undo() {
    if (inProgress.current) inProgress.current = null
    else draft.current.pop()
    setDraftVer(v => v + 1)
  }
  function persistNotes(next: VideoNote[]) {
    setNotes(next)
    setSentOk(false)
  }
  // Save notes + your points + removed points a moment after any change
  useEffect(() => {
    if (!loadedNotes.current || !canSave) return
    const data = { v: 2 as const, notes, points, hidden: Array.from(hidden), angles }
    const json = JSON.stringify(data)
    if (json === lastSaved.current) return
    setNotesMsg('Saving…')
    const tm = setTimeout(async () => {
      const r = await saveVideoNotes(path, data)
      if (!(r && 'error' in r && r.error)) lastSaved.current = json
      setNotesMsg(r && 'error' in r && r.error ? `Not saved: ${r.error}` : '✓ Saved')
    }, 800)
    return () => clearTimeout(tm)
  }, [notes, points, hidden, angles, canSave, path])
  function saveNote() {
    const strokes = draft.current.slice()
    if (!strokes.length && !noteText.trim()) { setDrawMode(false); return }
    const t = +(videoRef.current?.currentTime ?? 0).toFixed(3)
    const note: VideoNote = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, t, text: noteText.trim(), strokes }
    persistNotes([...notes, note].sort((a, b) => a.t - b.t))
    draft.current = []; inProgress.current = null; setNoteText(''); setDrawMode(false)
  }
  async function sendReview() {
    setSending(true)
    const r = await sendVideoReview(path, notes.length, comment)
    setSending(false)
    if (!r || 'error' in r) { setNotesMsg((r && 'error' in r && r.error) || 'Could not send.'); return }
    setSentOk(true); setComment('')
    if (r.message) onSent?.(r.message as Message)
  }
  const showingNotes = drawMode ? [] : notesAt(notes, time)

  // ---------- Player controls ----------
  const v = () => videoRef.current
  function togglePlay() {
    const el = v(); if (!el) return
    if (el.paused) { el.playbackRate = speed; el.play(); setPlaying(true) } else { el.pause(); setPlaying(false) }
  }
  function step(dir: number) {
    const el = v(); if (!el) return
    el.pause(); setPlaying(false)
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + dir / 30))
  }
  function goTo(t: number) {
    const el = v(); if (!el) return
    el.currentTime = Math.max(0, Math.min(el.duration || t, t))
  }
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = speed }, [speed])

  const total = duration || videoRef.current?.duration || (frames.length ? frames[frames.length - 1].t : 0)
  const result = analysis?.result

  return (
    <div className="fixed inset-0 z-[70] bg-zinc-950 overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-blue-400" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white">Form analysis</h2>
            <p className="text-xs text-zinc-500 truncate">{title.replace(/^🎥\s*Form check —\s*/, '')}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        {/* Exercise + view pickers (always available — changing them re-checks instantly) */}
        {phase !== 'checking' && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(EXERCISE_LABEL) as ExerciseKind[]).map(k => (
                <button key={k} onClick={() => setExercise(k)} disabled={phase === 'analyzing'}
                  className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium', exercise === k ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-zinc-700 text-zinc-400')}>
                  {EXERCISE_LABEL[k]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {(['side', 'front'] as View[]).map(vw => (
                <button key={vw} onClick={() => setView(vw)} disabled={phase === 'analyzing'}
                  className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium', view === vw ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-zinc-700 text-zinc-400')}>
                  {vw === 'side' ? 'Side view' : 'Front view'}
                </button>
              ))}
              <span className="text-[11px] text-zinc-500">How was it filmed?</span>
            </div>
          </div>
        )}

        {phase === 'checking' && <p className="text-sm text-zinc-400 py-10 text-center">Loading…</p>}

        {phase === 'setup' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300">
              <Camera className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
              <p>{TIPS[view]}</p>
            </div>
            <video src={src} controls playsInline className="w-full max-h-[50vh] rounded-xl bg-black" />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button onClick={run} className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-semibold text-white">
              🦴 Analyze form
            </button>
            <div className="flex rounded-xl border border-zinc-700 overflow-hidden text-sm">
              <button onClick={() => setBest(true)} className={cn('flex-1 py-2.5', best ? 'bg-zinc-700 text-white font-semibold' : 'text-zinc-400')}>Best tracking (slower)</button>
              <button onClick={() => setBest(false)} className={cn('flex-1 py-2.5', !best ? 'bg-zinc-700 text-white font-semibold' : 'text-zinc-400')}>Quick</button>
            </div>
            <button onClick={() => setPhase('ready')} className="w-full rounded-xl border border-zinc-700 py-3 text-sm font-medium text-zinc-200">
              ✏️ Just draw &amp; add notes (skip body tracking)
            </button>
            <p className="text-center text-[11px] text-zinc-500">Runs on this device — the video isn&apos;t sent anywhere. Older phones can take a minute.</p>
          </div>
        )}

        {phase === 'analyzing' && (
          <div className="space-y-3 py-8 text-center">
            <p className="text-sm text-white font-medium">Finding the body in each frame…</p>
            <div className="mx-auto h-2 max-w-sm rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="text-xs text-zinc-500">{Math.round(progress * 100)}% · keep this screen open</p>
            <button onClick={() => { cancel.current.cancelled = true; setPhase('setup') }} className="text-xs text-zinc-400 underline">Cancel</button>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <div
              ref={boxRef}
              onClick={onBoxTap}
              onPointerDown={onBoxPointerDown}
              onPointerMove={onBoxPointerMove}
              onPointerUp={onBoxPointerUp}
              onPointerCancel={onBoxPointerUp}
              style={{ touchAction: 'none' }}
              className={cn('relative w-full h-[55vh] rounded-xl bg-black overflow-hidden select-none', placing ? 'cursor-crosshair' : zoom > 1 ? 'cursor-grab' : 'cursor-pointer')}
            >
              <div ref={stageRef} className="absolute inset-0 origin-top-left" style={{ transform: 'translate(0px, 0px) scale(1)' }}>
              <video
                ref={videoRef}
                src={src}
                crossOrigin="anonymous"
                playsInline
                muted
                preload="auto"
                className="absolute inset-0 w-full h-full object-contain"
                onLoadedMetadata={e => { setDuration(e.currentTarget.duration); if (e.currentTarget.videoWidth) setAspect(e.currentTarget.videoWidth / e.currentTarget.videoHeight) }}
                onEnded={() => setPlaying(false)}
              />
              </div>
              <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
              <div className="absolute left-2 top-2 flex gap-2 text-[10px] font-semibold">
                <span className="rounded bg-black/70 px-1.5 py-0.5" style={{ color: COLORS.L }}>● Left</span>
                <span className="rounded bg-black/70 px-1.5 py-0.5" style={{ color: COLORS.R }}>● Right</span>
                {is3D && use3d && <span className="rounded bg-black/70 px-1.5 py-0.5 text-emerald-300">3D angles</span>}
              </div>
              {flash && <div className="absolute left-1/2 top-11 -translate-x-1/2 rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-white">{flash}</div>}
              {!drawMode && !placing && frames.length > 0 && showingNotes.length === 0 && <p className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-300">Tap a point for options · pinch or + to zoom</p>}
              {showingNotes.some(n => n.text) && (
                <div className="absolute inset-x-2 bottom-2 space-y-1">
                  {showingNotes.filter(n => n.text).map(n => (
                    <p key={n.id} className="rounded-lg bg-black/80 px-3 py-2 text-sm text-white shadow-lg border-l-4 border-yellow-400 whitespace-pre-wrap">{n.text}</p>
                  ))}
                </div>
              )}
              {drawMode && (
                <div
                  className="absolute inset-0 cursor-crosshair"
                  style={{ touchAction: 'none' }}
                  onClick={e => e.stopPropagation()}
                  onPointerDown={penDown}
                  onPointerMove={penMove}
                  onPointerUp={penUp}
                  onPointerCancel={penUp}
                />
              )}
              {drawMode && <div className="absolute left-1/2 top-9 -translate-x-1/2 rounded bg-yellow-400 px-2 py-0.5 text-[10px] font-bold text-black">DRAWING · {time.toFixed(2)}s</div>}
              {/* Zoom buttons */}
              <div className="absolute right-2 top-2 flex items-center gap-1" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                <button onClick={() => zoomBy(1 / 1.5)} disabled={zoom <= 1} className="w-8 h-8 rounded-lg bg-black/70 text-white flex items-center justify-center disabled:opacity-40" aria-label="Zoom out"><ZoomOut className="w-4 h-4" /></button>
                <button onClick={() => zoomBy(1.5)} disabled={zoom >= 6} className="w-8 h-8 rounded-lg bg-black/70 text-white flex items-center justify-center disabled:opacity-40" aria-label="Zoom in"><ZoomIn className="w-4 h-4" /></button>
                {zoom > 1.01 && <button onClick={() => applyZoom(1, 0, 0)} className="h-8 rounded-lg bg-black/70 px-2 text-[11px] font-semibold text-white">{zoom.toFixed(1)}× ✕</button>}
              </div>
              {/* Building an angle */}
              {picking && (
                <div className="absolute inset-x-2 bottom-2 rounded-lg bg-black/85 p-2.5 text-xs text-white space-y-1.5" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                  <p className="font-semibold text-yellow-300">
                    {picking.length === 0 ? 'Tap 1 of 3: one end (e.g. right shoulder)' : picking.length === 1 ? 'Tap 2 of 3: the joint in the middle (e.g. right elbow)' : 'Tap 3 of 3: the other end (e.g. right hand)'}
                  </p>
                  {picking.length > 0 && <p className="text-zinc-300">{picking.map(refName).join(' → ')}</p>}
                  <div className="flex gap-2">
                    {picking.length > 0 && <button onClick={() => setPicking(picking.slice(0, -1))} className="rounded bg-zinc-700 px-2.5 py-1">Undo</button>}
                    <button onClick={() => setPicking(null)} className="ml-auto rounded bg-zinc-700 px-3 py-1">Cancel</button>
                  </div>
                </div>
              )}
              {fixing && (
                <div className="absolute inset-x-2 bottom-2 rounded-lg bg-black/85 p-2.5 text-xs text-white space-y-1.5" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                  <p className="font-semibold text-sky-300">Fixing: {JOINT_LABEL[fixing]}</p>
                  <p className="text-zinc-300">Tap where it really is. Step with ‹ › and tap again to fix other frames. Zoom in for accuracy.</p>
                  <div className="flex gap-2">
                    <button onClick={() => step(-1)} className="rounded bg-zinc-700 px-2.5 py-1">‹</button>
                    <button onClick={() => step(1)} className="rounded bg-zinc-700 px-2.5 py-1">›</button>
                    <button onClick={() => setFixing(null)} className="ml-auto rounded bg-blue-600 px-3 py-1 font-semibold">Done</button>
                  </div>
                </div>
              )}
              {/* Placing your point */}
              {placing && (() => {
                const p = points.find(x => x.id === placing)
                return (
                  <div className="absolute inset-x-2 bottom-2 rounded-lg bg-black/85 p-2.5 text-xs text-white space-y-1.5" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                    <p><b style={{ color: p?.color }}>Placing: {p?.name}</b> · {p?.keys.length ?? 0} spot{p?.keys.length === 1 ? '' : 's'}</p>
                    <p className="text-zinc-300">Tap where it is. Then step ahead with › (or drag the slider) and tap again. Do a few spots through the movement and it fills in between. Tap again on the same frame to move it.</p>
                    <div className="flex gap-2">
                      <button onClick={() => step(-3)} className="rounded bg-zinc-700 px-2.5 py-1">‹‹</button>
                      <button onClick={() => step(3)} className="rounded bg-zinc-700 px-2.5 py-1">››</button>
                      <button onClick={() => setPlacing(null)} className="ml-auto rounded bg-blue-600 px-3 py-1 font-semibold">Done</button>
                    </div>
                  </div>
                )
              })()}
              {/* Tap menu for a point */}
              {menu && (
                <div
                  className="absolute z-10 w-48 rounded-xl border border-zinc-700 bg-zinc-900/95 p-1.5 shadow-xl text-sm"
                  style={{ left: Math.min(menu.x, (boxRef.current?.clientWidth ?? 300) - 200), top: Math.min(menu.y + 8, (boxRef.current?.clientHeight ?? 300) - 150) }}
                  onClick={e => e.stopPropagation()}
                  onPointerDown={e => e.stopPropagation()}
                >
                  {menu.joint && (() => {
                    const j = menu.joint!
                    const k = JOINT_ANGLE[j]
                    return (
                      <>
                        <p className="px-2 py-1 text-[11px] font-semibold text-zinc-400">{JOINT_LABEL[j]}</p>
                        {k && <button onClick={() => { toggleAngle(k); setMenu(null) }} className="w-full rounded-lg px-2 py-2 text-left text-white hover:bg-zinc-800">{shown.has(k) ? 'Hide' : 'Show'} {angleLabel(k).toLowerCase()} angle</button>}
                        <button onClick={() => { setFixing(j); setPlacing(null); setPicking(null); setMenu(null) }} className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-white hover:bg-zinc-800"><Move className="w-4 h-4" /> Fix its spot</button>
                        <button onClick={() => { startAngle(); setPicking([`joint:${j}`]); setMenu(null) }} className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-white hover:bg-zinc-800"><Triangle className="w-4 h-4" /> Start an angle here</button>
                        <button onClick={() => { removeJoint(j); setMenu(null) }} className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-red-300 hover:bg-zinc-800"><EyeOff className="w-4 h-4" /> Remove this point</button>
                      </>
                    )
                  })()}
                  {menu.point && (() => {
                    const p = points.find(x => x.id === menu.point)
                    if (!p) return null
                    return (
                      <>
                        <p className="px-2 py-1 text-[11px] font-semibold" style={{ color: p.color }}>{p.name}</p>
                        <button onClick={() => { setPlacing(p.id); setMenu(null) }} className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-white hover:bg-zinc-800"><Crosshair className="w-4 h-4" /> Move / add spots</button>
                        <button onClick={() => { setPoints(ps => ps.filter(x => x.id !== p.id).map(x => (x.link === `pt:${p.id}` ? { ...x, link: null } : x))); setMenu(null) }} className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-red-300 hover:bg-zinc-800"><Trash2 className="w-4 h-4" /> Delete point</button>
                      </>
                    )
                  })()}
                  <button onClick={() => setMenu(null)} className="w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-zinc-500 hover:bg-zinc-800">Close</button>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="space-y-2">
              <input
                type="range" min={0} max={total || 0} step={0.01} value={time}
                onChange={e => goTo(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex items-center gap-2">
                <button onClick={() => step(-1)} className="w-11 h-11 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200" aria-label="Back one frame"><ChevronLeft className="w-5 h-5" /></button>
                <button onClick={togglePlay} className="w-14 h-11 rounded-lg bg-blue-600 flex items-center justify-center text-white" aria-label={playing ? 'Pause' : 'Play'}>
                  {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button onClick={() => step(1)} className="w-11 h-11 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200" aria-label="Forward one frame"><ChevronRight className="w-5 h-5" /></button>
                <span className="text-xs tabular-nums text-zinc-400 ml-1">{time.toFixed(2)}s</span>
                <div className="ml-auto flex rounded-lg border border-zinc-700 overflow-hidden">
                  {SPEEDS.map(s => (
                    <button key={s} onClick={() => setSpeed(s)} className={cn('px-2.5 py-2 text-xs font-medium', speed === s ? 'bg-zinc-700 text-white' : 'text-zinc-400')}>
                      {s === 1 ? '1×' : s === 0.5 ? '½×' : '¼×'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Your points + removed body points */}
            {!drawMode && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <Crosshair className="w-4 h-4 text-fuchsia-400" /> Points
                  <span className="ml-auto text-[11px] font-normal text-zinc-500">Add a point to follow the bat, ball…</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {POINT_IDEAS.map(n => (
                    <button key={n} onClick={() => addPoint(n)} className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white">+ {n}</button>
                  ))}
                  <button onClick={() => { const n = window.prompt('Name this point (e.g. Bat tip)'); if (n?.trim()) addPoint(n.trim()) }} className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white">+ Other…</button>
                </div>
                {points.length > 0 && (
                  <ul className="divide-y divide-zinc-800">
                    {points.map(p => (
                      <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                        <span className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                        <span className="text-white">{p.name}</span>
                        <span className="text-[11px] text-zinc-500">{p.keys.length} spot{p.keys.length === 1 ? '' : 's'}</span>
                        <select
                          value={p.link ?? ''}
                          onChange={e => updatePoint(p.id, x => ({ ...x, link: e.target.value || null }))}
                          className="ml-auto max-w-[9rem] rounded bg-zinc-800 border border-zinc-700 px-1.5 py-1 text-[11px] text-zinc-200"
                          aria-label="Draw a line to"
                        >
                          <option value="">No line</option>
                          {frames.length > 0 && (['rHand', 'lHand', 'rWrist', 'lWrist', 'rFoot', 'lFoot'] as JointName[]).map(j => <option key={j} value={`joint:${j}`}>Line to {JOINT_LABEL[j].toLowerCase()}</option>)}
                          {points.filter(o => o.id !== p.id).map(o => <option key={o.id} value={`pt:${o.id}`}>Line to {o.name}</option>)}
                        </select>
                        <button onClick={() => { videoRef.current?.pause(); setPlaying(false); setPlacing(p.id) }} className={cn('rounded-lg border px-2 py-1 text-[11px]', placing === p.id ? 'border-blue-500 text-white' : 'border-zinc-700 text-zinc-300')}>Place</button>
                        <button onClick={() => setPoints(ps => ps.filter(x => x.id !== p.id).map(x => (x.link === `pt:${p.id}` ? { ...x, link: null } : x)))} className="p-1 text-zinc-500 hover:text-red-400" aria-label="Delete point"><Trash2 className="w-4 h-4" /></button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-t border-zinc-800 pt-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-300">Angles from 3 points</span>
                    <button onClick={startAngle} className="ml-auto rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-bold text-black">+ Pick 3 points</button>
                  </div>
                  {angles.length === 0 ? (
                    <p className="text-[11px] text-zinc-500">Example: right shoulder → right elbow → right hand shows the elbow bend all the way through the video. Works with your own points too (hand → bat tip).</p>
                  ) : (
                    <ul className="space-y-1">
                      {angles.map(a => (
                        <li key={a.id} className="flex items-center gap-2 text-sm">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: a.color }} />
                          <span className="flex-1 text-zinc-200 text-xs">{a.refs.map(refName).join(' → ')}</span>
                          <button onClick={() => setAngles(as => as.filter(x => x.id !== a.id))} className="p-1 text-zinc-500 hover:text-red-400" aria-label="Delete angle"><Trash2 className="w-4 h-4" /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {hidden.size > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-800 pt-2">
                    <span className="text-[11px] text-zinc-500">Removed:</span>
                    {Array.from(hidden).map(j => (
                      <button key={j} onClick={() => restoreJoint(j)} className="flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-white"><RotateCcw className="w-3 h-3" /> {JOINT_LABEL[j]}</button>
                    ))}
                    <button onClick={() => setHidden(new Set())} className="text-[11px] text-zinc-400 underline">Bring all back</button>
                  </div>
                )}
              </div>
            )}

            {/* Draw + notes */}
            {drawMode ? (
              <div className="rounded-xl border border-yellow-500/40 bg-zinc-900 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {([['pen', Pencil, 'Draw'], ['line', Minus, 'Line'], ['arrow', ArrowUpRight, 'Arrow'], ['circle', Circle, 'Circle'], ['angle', Triangle, 'Angle']] as const).map(([k, Icon, label]) => (
                    <button key={k} onClick={() => { setTool(k); inProgress.current = null }}
                      className={cn('flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium', tool === k ? 'border-yellow-400 bg-yellow-400/15 text-white' : 'border-zinc-700 text-zinc-400')}>
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {PEN_COLORS.map(c => (
                    <button key={c} onClick={() => setColor(c)} aria-label="Pen color"
                      className={cn('w-7 h-7 rounded-full border-2', color === c ? 'border-white scale-110' : 'border-zinc-700')} style={{ background: c }} />
                  ))}
                  <button onClick={undo} className="ml-auto flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300"><Undo2 className="w-3.5 h-3.5" /> Undo</button>
                  <button onClick={() => { draft.current = []; inProgress.current = null; setDraftVer(v => v + 1) }} className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300">Clear</button>
                </div>
                {tool === 'angle' && (
                  <p className="text-[12px] font-medium text-yellow-300">
                    {(() => { const n = inProgress.current?.tool === 'angle' ? inProgress.current.pts.length : 0; void draftVer
                      return n === 0 ? 'Angle — tap 1 of 3: one end (e.g. shoulder)' : n === 1 ? 'Tap 2 of 3: the joint in the middle (e.g. elbow)' : 'Tap 3 of 3: the other end (e.g. hand)' })()}
                    <span className="block text-[11px] font-normal text-zinc-400">Taps near a body point snap onto it. If all 3 are body points, it shows the 3D angle.</span>
                  </p>
                )}
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  rows={2}
                  placeholder={`Note at ${time.toFixed(2)}s — e.g. "Keep your back elbow up here"`}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
                <div className="flex gap-2">
                  <button onClick={saveNote} className="flex-1 rounded-lg bg-yellow-400 py-2.5 text-sm font-bold text-black">Save note at {time.toFixed(2)}s</button>
                  <button onClick={() => { draft.current = []; inProgress.current = null; setDrawMode(false) }} className="rounded-lg border border-zinc-700 px-4 text-sm text-zinc-300">Cancel</button>
                </div>
                <p className="text-[10px] text-zinc-500">Tip: use ‹ › to move to the exact frame first. {draftVer > 0 && draft.current.length ? `${draft.current.length} drawing${draft.current.length === 1 ? '' : 's'}` : ''}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-semibold text-zinc-300">Notes &amp; drawings</span>
                  <label className="ml-auto flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <input type="checkbox" checked={pauseAtNotes} onChange={e => setPauseAtNotes(e.target.checked)} /> Pause at notes
                  </label>
                </div>
                {canSave && (
                  <button onClick={startDrawing} className="w-full flex items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-sm font-bold text-black">
                    <Pencil className="w-4 h-4" /> Draw / add note at {time.toFixed(2)}s
                  </button>
                )}
                {notes.length === 0 ? (
                  <p className="text-[11px] text-zinc-500">Pause where you want to coach something, then tap Draw. The note pops up at that moment when the video plays.</p>
                ) : (
                  <ul className="divide-y divide-zinc-800">
                    {notes.map(n => (
                      <li key={n.id} className="flex items-start gap-2 py-2">
                        <button onClick={() => { videoRef.current?.pause(); setPlaying(false); goTo(n.t) }} className="shrink-0 rounded bg-zinc-800 px-2 py-1 text-xs tabular-nums text-yellow-300">{n.t.toFixed(2)}s</button>
                        <p className="flex-1 text-sm text-zinc-200 whitespace-pre-wrap">
                          {n.text || <span className="text-zinc-500">(drawing)</span>}
                          {n.strokes.length > 0 && n.text && <span className="ml-1 text-[11px] text-zinc-500">✏️</span>}
                        </p>
                        {canSave && <button onClick={() => persistNotes(notes.filter(x => x.id !== n.id))} className="p-1 text-zinc-500 hover:text-red-400" aria-label="Delete note"><Trash2 className="w-4 h-4" /></button>}
                      </li>
                    ))}
                  </ul>
                )}
                {notes.length > 0 && canSave && (
                  <div className="space-y-2 border-t border-zinc-800 pt-2.5">
                    <input
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Message with it (optional)"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={sendReview} disabled={sending} className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                      <Send className="w-4 h-4" /> {sending ? 'Sending…' : sentOk ? 'Sent ✓ — send again' : 'Send review back'}
                    </button>
                  </div>
                )}
                {notesMsg && <p className="text-[11px] text-zinc-500">{notesMsg}</p>}
              </div>
            )}

            {frames.length === 0 && (
              <button onClick={run} className="w-full rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-200">🦴 Add body tracking (skeleton + angles)</button>
            )}

            {frames.length > 0 && !is3D && (
              <p className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-400">This video was analyzed before 3D angles and hand points were added. Tap <b>Analyze again</b> at the bottom (Best tracking) to get them.</p>
            )}

            {/* Markers: turn anything on or off */}
            {frames.length > 0 && <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <SlidersHorizontal className="w-4 h-4 text-blue-400" /> Markers
                <div className="ml-auto flex gap-1.5">
                  {is3D && <Toggle on={use3d} onClick={() => setUse3d(b => !b)}>3D angles</Toggle>}
                  <Toggle on={showBones} onClick={() => setShowBones(b => !b)}>Skeleton</Toggle>
                  <Toggle on={showPoints} onClick={() => setShowPoints(b => !b)}>Points</Toggle>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ANGLE_KEYS.map(k => (
                  <Toggle key={k} on={shown.has(k)} onClick={() => toggleAngle(k)} color={ANGLE_INFO[k].side === 'C' ? '#e4e4e7' : COLORS[ANGLE_INFO[k].side]}>
                    {angleLabel(k)}
                  </Toggle>
                ))}
              </div>
              <div className="flex gap-3 text-[11px]">
                <button onClick={() => setShown(new Set(ANGLE_KEYS))} className="text-zinc-400 underline">Show all</button>
                <button onClick={() => setShown(new Set())} className="text-zinc-400 underline">Hide all</button>
                <button onClick={() => setShown(defaultShown(exercise, view, side))} className="text-zinc-400 underline">Reset</button>
              </div>
            </div>}

            {analysis && (
              <AngleGraph
                frames={frames} angles={analysis.angles} primary={analysis.primary} result={analysis.result} time={time} onSeek={goTo}
                graphKey={graphKey} setGraphKey={setGraphKey}
              />
            )}

            {analysis && shown.size > 0 && <AngleSummary frames={frames} angles={analysis.angles} keys={ANGLE_KEYS.filter(k => shown.has(k))} onSeek={goTo} />}

            {result && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  {result.checks.map((c, i) => (
                    <p key={i} className={cn('flex items-start gap-2 text-sm',
                      c.level === 'ok' ? 'text-green-300' : c.level === 'warn' ? 'text-amber-300' : 'text-zinc-300')}>
                      {c.level === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : c.level === 'warn' ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : <Info className="w-4 h-4 mt-0.5 shrink-0" />}
                      {c.text}
                    </p>
                  ))}
                </div>

                {result.reps.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-zinc-800">
                    <table className="w-full text-sm">
                      <thead className="text-[11px] uppercase tracking-wide text-zinc-500 bg-zinc-900">
                        <tr>
                          <th className="px-3 py-2 text-left">Rep</th>
                          <th className="px-3 py-2 text-right">Down</th>
                          <th className="px-3 py-2 text-right">Up</th>
                          <th className="px-3 py-2 text-right">{result.primary.label} (lowest)</th>
                          {result.exercise === 'squat' && result.view === 'side' && <th className="px-3 py-2 text-center">Depth</th>}
                          {result.view === 'front' && <th className="px-3 py-2 text-center">Knees</th>}
                          {result.view === 'front' && <th className="px-3 py-2 text-right">L/R diff</th>}
                          {result.view === 'side' && <th className="px-3 py-2 text-right">Torso</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {result.reps.map(r => (
                          <tr key={r.n} onClick={() => goTo(r.bottom)} className="cursor-pointer hover:bg-zinc-800/50">
                            <td className="px-3 py-2 text-white">#{r.n}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{r.down.toFixed(1)}s</td>
                            <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{r.up.toFixed(1)}s</td>
                            <td className="px-3 py-2 text-right tabular-nums text-white">{r.bottomAngle}°</td>
                            {result.exercise === 'squat' && result.view === 'side' && <td className="px-3 py-2 text-center">{r.depthOk == null ? '—' : r.depthOk ? '✅' : '⚠️'}</td>}
                            {result.view === 'front' && <td className="px-3 py-2 text-center">{r.kneeCave == null ? '—' : r.kneeCave ? '⚠️ in' : '✅'}</td>}
                            {result.view === 'front' && <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{r.lrDiff == null ? '—' : `${r.lrDiff}°`}</td>}
                            {result.view === 'side' && <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{r.trunk == null ? '—' : `${r.trunk}°`}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="px-3 py-2 text-[11px] text-zinc-500 border-t border-zinc-800">Tap a rep to jump to its lowest point.</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{canSave ? (saved ? '✓ Saved — opens instantly next time' : 'Saving…') : 'Not saved (viewing only)'}</span>
                  <button onClick={() => { setFrames([]); setSaved(false); setPhase('setup') }} className="flex items-center gap-1 text-zinc-400 hover:text-white">
                    <RefreshCw className="w-3.5 h-3.5" /> Analyze again
                  </button>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Angles come from a single phone camera, so they&apos;re most accurate when filmed straight from the side or front. Use them as a coaching guide, not a lab measurement.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** Primary angle over time with rep bands; tap to jump the video */
function AngleGraph({ frames, angles, primary, result, time, onSeek, graphKey, setGraphKey }: {
  frames: PoseFrame[]; angles: Angles[]; primary: (number | null)[]; result: AnalysisResult; time: number; onSeek: (t: number) => void
  graphKey: 'auto' | AngleKey; setGraphKey: (k: 'auto' | AngleKey) => void
}) {
  const W = 600, H = 140, pad = 24
  const t0 = frames[0]?.t ?? 0, t1 = frames[frames.length - 1]?.t ?? 1
  const trunk = angles.map(a => a.trunk)
  const series = graphKey !== 'auto' ? angles.map(a => a[graphKey]) : result.primary.key === 'none' ? angles.map(a => a.lKnee ?? a.rKnee) : primary
  const seriesName = graphKey !== 'auto' ? angleLabel(graphKey) : result.primary.key === 'none' ? 'Knee angle' : result.primary.label
  const vals = [...series, ...trunk].filter((v): v is number => v != null)
  if (vals.length < 2) return null
  const lo = Math.max(0, Math.min(...vals) - 10), hi = Math.min(200, Math.max(...vals) + 10)
  const X = (t: number) => pad + ((t - t0) / Math.max(0.001, t1 - t0)) * (W - pad * 2)
  const Y = (v: number) => H - pad - ((v - lo) / Math.max(1, hi - lo)) * (H - pad * 2)
  const line = (s: (number | null)[]) => {
    let d = '', pen = false
    s.forEach((v, i) => {
      if (v == null) { pen = false; return }
      d += `${pen ? 'L' : 'M'}${X(frames[i].t).toFixed(1)},${Y(v).toFixed(1)} `
      pen = true
    })
    return d
  }
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-2">
      <div className="flex items-center gap-3 px-1 pb-1 text-[11px]">
        <select
          value={graphKey}
          onChange={e => setGraphKey(e.target.value as 'auto' | AngleKey)}
          className="rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-blue-300 text-[11px]"
          aria-label="Angle to graph"
        >
          <option value="auto">— {graphKey === 'auto' ? seriesName : result.primary.key === 'none' ? 'Knee angle' : result.primary.label}</option>
          {ANGLE_KEYS.map(k => <option key={k} value={k}>— {angleLabel(k)}</option>)}
        </select>
        <span className="text-zinc-400">— Torso lean</span>
        <span className="ml-auto text-zinc-500">Tap to jump</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto cursor-pointer"
        onClick={e => {
          const r = e.currentTarget.getBoundingClientRect()
          const x = ((e.clientX - r.left) / r.width) * W
          onSeek(t0 + ((x - pad) / (W - pad * 2)) * (t1 - t0))
        }}
      >
        {result.reps.map(r => (
          <rect key={r.n} x={X(r.start)} y={pad / 2} width={Math.max(1, X(r.end) - X(r.start))} height={H - pad * 1.5} fill="rgba(59,130,246,0.08)" />
        ))}
        {[lo, (lo + hi) / 2, hi].map(v => (
          <g key={v}>
            <line x1={pad} x2={W - pad} y1={Y(v)} y2={Y(v)} stroke="#27272a" />
            <text x={2} y={Y(v) + 4} fontSize="10" fill="#71717a">{Math.round(v)}°</text>
          </g>
        ))}
        <path d={line(trunk)} fill="none" stroke="#a1a1aa" strokeWidth="1.5" opacity="0.6" />
        <path d={line(series)} fill="none" stroke="#60a5fa" strokeWidth="2.5" />
        {result.reps.map(r => (
          <text key={`n${r.n}`} x={X(r.bottom)} y={H - 6} fontSize="10" fill="#93c5fd" textAnchor="middle">#{r.n}</text>
        ))}
        <line x1={X(time)} x2={X(time)} y1={pad / 2} y2={H - pad} stroke="#fbbf24" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

function Toggle({ on, onClick, color, children }: { on: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
        on ? 'border-zinc-500 bg-zinc-700 text-white' : 'border-zinc-800 text-zinc-500')}
    >
      {color && <span className="mr-1" style={{ color: on ? color : undefined }}>●</span>}
      {children}
    </button>
  )
}

/** Lowest and highest value of each shown angle, tap to jump to that moment */
function AngleSummary({ frames, angles, keys, onSeek }: { frames: PoseFrame[]; angles: Angles[]; keys: AngleKey[]; onSeek: (t: number) => void }) {
  const rows = keys.map(k => {
    let lo: { v: number; t: number } | null = null, hi: { v: number; t: number } | null = null
    angles.forEach((a, i) => {
      const v = a[k]
      if (v == null) return
      if (!lo || v < lo.v) lo = { v, t: frames[i].t }
      if (!hi || v > hi.v) hi = { v, t: frames[i].t }
    })
    return { k, lo: lo as { v: number; t: number } | null, hi: hi as { v: number; t: number } | null }
  }).filter(r => r.lo && r.hi)
  if (!rows.length) return null
  const Cell = ({ x }: { x: { v: number; t: number } }) => (
    <button onClick={() => onSeek(x.t)} className="tabular-nums text-white hover:text-blue-300">
      {Math.round(x.v)}° <span className="text-[10px] text-zinc-500">@{x.t.toFixed(2)}s</span>
    </button>
  )
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-zinc-500 bg-zinc-900">
          <tr><th className="px-3 py-2 text-left">Angle</th><th className="px-3 py-2 text-right">Lowest</th><th className="px-3 py-2 text-right">Highest</th><th className="px-3 py-2 text-right">Range</th></tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map(({ k, lo, hi }) => (
            <tr key={k}>
              <td className="px-3 py-2 whitespace-nowrap" style={{ color: ANGLE_INFO[k].side === 'C' ? '#e4e4e7' : COLORS[ANGLE_INFO[k].side] }}>{angleLabel(k)}</td>
              <td className="px-3 py-2 text-right"><Cell x={lo!} /></td>
              <td className="px-3 py-2 text-right"><Cell x={hi!} /></td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{Math.round(hi!.v - lo!.v)}°</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[11px] text-zinc-500 border-t border-zinc-800">Tap a number to jump to that moment in the video.</p>
    </div>
  )
}
