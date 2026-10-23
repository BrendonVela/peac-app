'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, RotateCcw, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'

type Mode = 'interval' | 'emom' | 'tabata' | 'stopwatch'
type Kind = 'prep' | 'work' | 'rest'
interface Segment { kind: Kind; seconds: number; label: string }

const PREP = 5

function clock(s: number) {
  const t = Math.max(0, Math.ceil(s))
  const m = Math.floor(t / 60)
  return `${m}:${String(t % 60).padStart(2, '0')}`
}

function buildSegments(mode: Mode, cfg: { work: number; rest: number; rounds: number; emomMin: number; emomSec: number }): Segment[] {
  const segs: Segment[] = [{ kind: 'prep', seconds: PREP, label: 'Get ready' }]
  if (mode === 'tabata') {
    for (let r = 1; r <= 8; r++) {
      segs.push({ kind: 'work', seconds: 20, label: `Work · ${r}/8` })
      if (r < 8) segs.push({ kind: 'rest', seconds: 10, label: `Rest · ${r}/8` })
    }
  } else if (mode === 'interval') {
    for (let r = 1; r <= cfg.rounds; r++) {
      segs.push({ kind: 'work', seconds: cfg.work, label: `Work · ${r}/${cfg.rounds}` })
      if (r < cfg.rounds && cfg.rest > 0) segs.push({ kind: 'rest', seconds: cfg.rest, label: `Rest · ${r}/${cfg.rounds}` })
    }
  } else if (mode === 'emom') {
    for (let r = 1; r <= cfg.emomMin; r++) segs.push({ kind: 'work', seconds: cfg.emomSec, label: `Minute ${r}/${cfg.emomMin}` })
  }
  return segs
}

export function IntervalTimer() {
  const [mode, setMode] = useState<Mode>('interval')
  const [work, setWork] = useState(30)
  const [rest, setRest] = useState(30)
  const [rounds, setRounds] = useState(8)
  const [emomMin, setEmomMin] = useState(10)
  const [emomSec, setEmomSec] = useState(60)
  const [sound, setSound] = useState(true)

  const [running, setRunning] = useState(false)
  const [started, setStarted] = useState(false)
  const [segIndex, setSegIndex] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [elapsed, setElapsed] = useState(0) // stopwatch
  const [done, setDone] = useState(false)

  const segments = useMemo(() => buildSegments(mode, { work, rest, rounds, emomMin, emomSec }), [mode, work, rest, rounds, emomMin, emomSec])
  const audio = useRef<AudioContext | null>(null)
  const lastTick = useRef<number>(0)
  const lastBeep = useRef<number>(-1)
  const wake = useRef<any>(null)

  function beep(freq = 880, ms = 150) {
    if (!sound) return
    try {
      audio.current ??= new (window.AudioContext || (window as any).webkitAudioContext)()
      const ctx = audio.current!
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.frequency.value = freq; o.connect(g); g.connect(ctx.destination)
      g.gain.setValueAtTime(0.25, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000)
      o.start(); o.stop(ctx.currentTime + ms / 1000)
    } catch { /* no audio */ }
  }
  function buzz(pattern: number | number[]) { try { navigator.vibrate?.(pattern) } catch { /* ignore */ } }

  async function keepAwake(on: boolean) {
    try {
      if (on && 'wakeLock' in navigator) wake.current = await (navigator as any).wakeLock.request('screen')
      if (!on) { await wake.current?.release?.(); wake.current = null }
    } catch { /* not supported */ }
  }

  function reset() {
    setRunning(false); setStarted(false); setDone(false)
    setSegIndex(0); setRemaining(segments[0]?.seconds ?? 0); setElapsed(0)
    lastBeep.current = -1
    keepAwake(false)
  }
  useEffect(reset, [segments]) // eslint-disable-line react-hooks/exhaustive-deps

  function startPause() {
    if (done) reset()
    if (!audio.current) beep(1, 1) // unlock audio on iPhone with the tap
    if (!started) { setStarted(true); setRemaining(segments[0]?.seconds ?? 0) }
    lastTick.current = performance.now()
    setRunning(r => { keepAwake(!r); return !r })
  }

  function next() {
    if (mode === 'stopwatch') return
    const n = segIndex + 1
    if (n >= segments.length) { finish(); return }
    setSegIndex(n); setRemaining(segments[n].seconds); lastBeep.current = -1
  }

  function finish() {
    setRunning(false); setDone(true); keepAwake(false)
    beep(660, 600); buzz([300, 100, 300])
  }

  useEffect(() => {
    if (!running) return
    let raf = 0
    const loop = (now: number) => {
      const dt = (now - lastTick.current) / 1000
      lastTick.current = now
      if (mode === 'stopwatch') {
        setElapsed(e => e + dt)
      } else {
        setRemaining(r => {
          const nr = r - dt
          const whole = Math.ceil(nr)
          if (whole <= 3 && whole >= 1 && whole !== lastBeep.current) { lastBeep.current = whole; beep(880, 120) }
          if (nr <= 0) {
            setSegIndex(i => {
              const n = i + 1
              if (n >= segments.length) { finish(); return i }
              const seg = segments[n]
              lastBeep.current = -1
              beep(seg.kind === 'work' ? 1320 : 520, 350)
              buzz(seg.kind === 'work' ? [200, 80, 200] : 300)
              setTimeout(() => setRemaining(seg.seconds + nr), 0)
              return n
            })
            return 0
          }
          return nr
        })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, mode, segments]) // eslint-disable-line react-hooks/exhaustive-deps

  const seg = segments[segIndex]
  const kind: Kind = mode === 'stopwatch' ? 'work' : seg?.kind ?? 'prep'
  const total = seg?.seconds ?? 1
  const pct = mode === 'stopwatch' ? 0 : Math.min(100, ((total - remaining) / total) * 100)
  const totalTime = segments.slice(1).reduce((n, s) => n + s.seconds, 0)

  const num = (label: string, value: number, set: (n: number) => void, min: number, max: number, step = 5) => (
    <label className="flex flex-col gap-1 text-xs text-zinc-400">
      {label}
      <div className="flex items-center gap-1">
        <button onClick={() => set(Math.max(min, value - step))} className="w-9 h-10 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-lg">−</button>
        <input
          value={value}
          onChange={e => set(Math.min(max, Math.max(min, Number(e.target.value.replace(/\D/g, '')) || min)))}
          inputMode="numeric"
          className="w-16 h-10 text-center bg-zinc-900 border border-zinc-700 rounded-lg text-white"
        />
        <button onClick={() => set(Math.min(max, value + step))} className="w-9 h-10 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-lg">+</button>
      </div>
    </label>
  )

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
        {([['interval', 'Intervals'], ['emom', 'EMOM'], ['tabata', 'Tabata'], ['stopwatch', 'Stopwatch']] as [Mode, string][]).map(([m, l]) => (
          <button
            key={m}
            disabled={started && !done}
            onClick={() => setMode(m)}
            className={cn('rounded-lg py-2 text-sm font-medium', mode === m ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white disabled:opacity-40')}
          >
            {l}
          </button>
        ))}
      </div>

      {!started && (
        <div className="flex flex-wrap gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          {mode === 'interval' && <>{num('Work (sec)', work, setWork, 5, 600)}{num('Rest (sec)', rest, setRest, 0, 600)}{num('Rounds', rounds, setRounds, 1, 50, 1)}</>}
          {mode === 'emom' && <>{num('Minutes', emomMin, setEmomMin, 1, 60, 1)}{num('Every (sec)', emomSec, setEmomSec, 15, 300, 15)}</>}
          {mode === 'tabata' && <p className="text-sm text-zinc-400">20 seconds work, 10 seconds rest, 8 rounds (4 minutes).</p>}
          {mode === 'stopwatch' && <p className="text-sm text-zinc-400">Counts up. Great for sprints, carries and timed holds.</p>}
          {mode !== 'stopwatch' && <p className="basis-full text-xs text-zinc-500">Total: {clock(totalTime)} (+{PREP}s to get ready)</p>}
        </div>
      )}

      <div
        className={cn(
          'relative overflow-hidden rounded-3xl border p-6 text-center select-none',
          done ? 'border-green-600/50 bg-green-950/60'
            : kind === 'work' ? 'border-blue-600/50 bg-blue-950/50'
            : kind === 'rest' ? 'border-amber-600/50 bg-amber-950/40'
            : 'border-zinc-700 bg-zinc-900'
        )}
      >
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30">
          <div className={cn('h-full transition-[width] duration-100', kind === 'rest' ? 'bg-amber-400' : 'bg-blue-400')} style={{ width: `${pct}%` }} />
        </div>
        <p className={cn('text-sm font-semibold uppercase tracking-widest',
          done ? 'text-green-300' : kind === 'work' ? 'text-blue-300' : kind === 'rest' ? 'text-amber-300' : 'text-zinc-400')}>
          {done ? 'Done!' : mode === 'stopwatch' ? 'Stopwatch' : started ? seg?.label : 'Ready'}
        </p>
        <p className="mt-2 text-7xl sm:text-8xl font-bold tabular-nums text-white">
          {mode === 'stopwatch' ? `${clock(elapsed)}.${Math.floor((elapsed % 1) * 10)}` : clock(started ? remaining : segments[1]?.seconds ?? 0)}
        </p>
        {mode !== 'stopwatch' && started && !done && segments[segIndex + 1] && (
          <p className="mt-2 text-sm text-zinc-400">Next: {segments[segIndex + 1].label}</p>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button onClick={reset} className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300" aria-label="Reset">
          <RotateCcw className="w-6 h-6" />
        </button>
        <button onClick={startPause} className={cn('w-20 h-20 rounded-full flex items-center justify-center text-white', running ? 'bg-amber-500' : 'bg-blue-600')} aria-label={running ? 'Pause' : 'Start'}>
          {running ? <Pause className="w-9 h-9" /> : <Play className="w-9 h-9 ml-1" />}
        </button>
        <button onClick={next} disabled={mode === 'stopwatch' || !started || done} className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 disabled:opacity-30" aria-label="Skip">
          <SkipForward className="w-6 h-6" />
        </button>
        <button onClick={() => setSound(s => !s)} className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300" aria-label="Sound">
          {sound ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
        </button>
      </div>
      <p className="text-center text-xs text-zinc-500">Beeps on the last 3 seconds and at every switch. The screen stays on while it runs.</p>
    </div>
  )
}
