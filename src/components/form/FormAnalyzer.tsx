'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Play, Pause, ChevronLeft, ChevronRight, Activity, CheckCircle2, AlertTriangle, Info, RefreshCw, Camera, SlidersHorizontal } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { saveVideoAnalysis } from '@/app/actions/videoAnalysis'
import { extractPose, loadPoseEngine } from '@/lib/pose/engine'
import {
  analyze, frameAngles, pt, BONES, EXERCISE_LABEL, guessExercise, ANGLE_INFO, ANGLE_KEYS, angleLabel, JOINT_NAMES,
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
  lHip: 'lHip', rHip: 'rHip', lKnee: 'lKnee', rKnee: 'rKnee', lAnkle: 'lAnkle', rAnkle: 'rAnkle', lHeel: 'lAnkle', rHeel: 'rAnkle', lFoot: 'lAnkle', rFoot: 'rAnkle',
}

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
  }
}

export function FormAnalyzer({ src, path, title, canSave, onClose }: {
  src: string
  path: string
  title: string
  canSave: boolean
  onClose: () => void
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
  const cancel = useRef({ cancelled: false })

  // Saved results from an earlier run?
  useEffect(() => {
    let alive = true
    createClient()
      .from('video_analyses')
      .select('exercise, view, result, frames')
      .eq('video_path', path)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        if (data?.frames?.length) {
          setExercise(data.exercise as ExerciseKind)
          setView(data.view as View)
          setFrames(data.frames as PoseFrame[])
          if ((data.result as AnalysisResult)?.aspect) setAspect((data.result as AnalysisResult).aspect)
          setSaved(true)
          setPhase('ready')
        } else {
          setPhase('setup')
          loadPoseEngine().catch(() => {}) // warm up while they pick options
        }
      })
    return () => { alive = false; cancel.current.cancelled = true }
  }, [path])

  const analysis = useMemo(
    () => (frames.length ? analyze(frames, exercise, view, aspect, duration || frames[frames.length - 1].t) : null),
    [frames, exercise, view, aspect, duration]
  )

  // New exercise / camera view -> start from that exercise's usual markers
  const side = analysis?.result.side
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
    return { W, H, dw, dh, ox: (W - dw) / 2, oy: (H - dh) / 2, va }
  }

  /** Tap a body point to turn its angle on/off; tap anywhere else to play/pause */
  function onBoxTap(e: React.MouseEvent<HTMLDivElement>) {
    const r = videoRect(), video = videoRef.current, box = boxRef.current
    if (!r || !video || !box) return
    const b = box.getBoundingClientRect()
    const x = e.clientX - b.left, y = e.clientY - b.top
    const f = frameAt(frames, video.currentTime)
    let best: JointName | null = null, bestD = 28
    if (f && showPoints) {
      for (const j of JOINT_NAMES) {
        const p = pt(f, j)
        if (!p || p.v < 0.35) continue
        const d = Math.hypot(r.ox + p.x * r.dw - x, r.oy + p.y * r.dh - y)
        if (d < bestD) { bestD = d; best = j }
      }
    }
    const k = best ? JOINT_ANGLE[best] : undefined
    if (k) toggleAngle(k)
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
      const fps = v.duration > 40 ? 8 : v.duration > 20 ? 10 : 15
      const out = await extractPose(v, { fps, onProgress: setProgress, signal: cancel.current })
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
    if (!f) return
    const P = (j: JointName) => {
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
    for (const [a, , side] of showPoints ? BONES : []) {
      const A = P(a)
      if (!A) continue
      if (ringed.has(a)) { ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(A.x, A.y, 9, 0, Math.PI * 2); ctx.stroke() }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(A.x, A.y, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = COLORS[side === 'C' ? (a.startsWith('l') ? 'L' : 'R') : side]
      ctx.beginPath(); ctx.arc(A.x, A.y, 3.2, 0, Math.PI * 2); ctx.fill()
    }
    // Angle labels next to the joints
    const ang = frameAngles(f, va)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, aspect, shown, showBones, showPoints])

  useEffect(() => {
    if (phase !== 'ready') return
    let raf = 0
    let last = -1
    const loop = () => {
      draw()
      const ct = videoRef.current?.currentTime ?? 0
      if (Math.abs(ct - last) > 0.03) { last = ct; setTime(ct) }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase, draw])

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
            <div ref={boxRef} onClick={onBoxTap} className="relative w-full h-[55vh] rounded-xl bg-black overflow-hidden cursor-pointer select-none">
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
              <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
              <div className="absolute left-2 top-2 flex gap-2 text-[10px] font-semibold">
                <span className="rounded bg-black/70 px-1.5 py-0.5" style={{ color: COLORS.L }}>● Left</span>
                <span className="rounded bg-black/70 px-1.5 py-0.5" style={{ color: COLORS.R }}>● Right</span>
              </div>
              {flash && <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-white">{flash}</div>}
              <p className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-300">Tap a point to show/hide its angle</p>
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

            {/* Markers: turn anything on or off */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <SlidersHorizontal className="w-4 h-4 text-blue-400" /> Markers
                <div className="ml-auto flex gap-1.5">
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
            </div>

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
