'use client'

import { useEffect, useRef, useState } from 'react'
import { Timer, X, Minus, Plus, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatClock, REST_START_EVENT, SET_DONE_EVENT, type RestEventDetail } from '@/lib/rest'

const AUTO_KEY = 'peac-rest-auto'
const PRESETS = [60, 90, 120, 180]

function readAuto(): boolean {
  try { return localStorage.getItem(AUTO_KEY) === '1' } catch { return false }
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[0, 0.25, 0.5].forEach(t => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.25, ctx.currentTime + t)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.2)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch { /* sound not available */ }
}

/** One floating rest timer for the whole workout page */
export function RestTimer() {
  const [endAt, setEndAt] = useState<number | null>(null)
  const [total, setTotal] = useState(90)
  const [title, setTitle] = useState('')
  const [now, setNow] = useState(Date.now())
  const [finished, setFinished] = useState(false)
  const [auto, setAuto] = useState(false)
  const autoRef = useRef(false)

  useEffect(() => { const a = readAuto(); setAuto(a); autoRef.current = a }, [])

  function start(seconds: number, label: string) {
    setTotal(seconds)
    setTitle(label)
    setFinished(false)
    setEndAt(Date.now() + seconds * 1000)
    setNow(Date.now())
  }

  // Listen for "start rest" (button) and "set done" (auto-start, if switched on)
  useEffect(() => {
    const onStart = (e: Event) => {
      const d = (e as CustomEvent<RestEventDetail>).detail
      start(d.seconds, d.title)
    }
    const onSetDone = (e: Event) => {
      if (!autoRef.current) return
      const d = (e as CustomEvent<RestEventDetail>).detail
      start(d.seconds, d.title)
    }
    window.addEventListener(REST_START_EVENT, onStart)
    window.addEventListener(SET_DONE_EVENT, onSetDone)
    return () => {
      window.removeEventListener(REST_START_EVENT, onStart)
      window.removeEventListener(SET_DONE_EVENT, onSetDone)
    }
  }, [])

  // Tick
  useEffect(() => {
    if (endAt === null || finished) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= endAt) {
        setFinished(true)
        beep()
        try { navigator.vibrate?.([300, 150, 300, 150, 300]) } catch { /* not supported */ }
      }
    }, 250)
    return () => clearInterval(id)
  }, [endAt, finished])

  function toggleAuto() {
    const next = !auto
    setAuto(next)
    autoRef.current = next
    try { localStorage.setItem(AUTO_KEY, next ? '1' : '0') } catch { /* private mode */ }
  }

  function adjust(delta: number) {
    if (endAt === null) return
    const nextEnd = Math.max(Date.now() + 1000, (finished ? Date.now() : endAt) + delta * 1000)
    setEndAt(nextEnd)
    setTotal(t => Math.max(5, t + delta))
    setFinished(false)
  }

  function close() { setEndAt(null); setFinished(false) }

  if (endAt === null) return null

  const remaining = Math.max(0, (endAt - now) / 1000)
  const pct = total > 0 ? Math.min(100, ((total - remaining) / total) * 100) : 100

  return (
    <div className="rest-timer fixed inset-x-0 bottom-0 z-40 md:left-60 px-3 pb-3 pointer-events-none">
      <div
        className={cn(
          'pointer-events-auto max-w-2xl mx-auto rounded-2xl border shadow-2xl overflow-hidden',
          finished ? 'bg-green-950 border-green-600/60' : 'bg-zinc-900 border-zinc-700'
        )}
      >
        <div className="h-1 bg-zinc-800">
          <div className={cn('h-full transition-all', finished ? 'bg-green-500' : 'bg-blue-500')} style={{ width: `${pct}%` }} />
        </div>
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <Timer className={cn('w-5 h-5 shrink-0', finished ? 'text-green-400' : 'text-blue-400')} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-zinc-400 truncate">{finished ? 'Rest done — next set!' : `Rest · ${title}`}</p>
              <p className={cn('text-2xl font-bold tabular-nums', finished ? 'text-green-400' : 'text-white')}>
                {finished ? '0:00' : formatClock(remaining)}
              </p>
            </div>
            <button onClick={() => adjust(-15)} className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center text-xs" aria-label="15 seconds less">
              <Minus className="w-3 h-3" />15
            </button>
            <button onClick={() => adjust(15)} className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center text-xs" aria-label="15 seconds more">
              <Plus className="w-3 h-3" />15
            </button>
            <button onClick={close} className="w-10 h-10 rounded-lg text-zinc-400 hover:text-white flex items-center justify-center" aria-label="Close timer">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => start(p, title)}
                className="px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:text-white"
              >
                {formatClock(p)}
              </button>
            ))}
            <button
              onClick={() => start(total, title)}
              className="px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:text-white flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Restart
            </button>
            <label className="ml-auto flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
              <span>Auto-start after each set</span>
              <button
                type="button"
                role="switch"
                aria-checked={auto}
                onClick={toggleAuto}
                className={cn('w-9 h-5 rounded-full relative transition-colors', auto ? 'bg-blue-600' : 'bg-zinc-700')}
              >
                <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', auto ? 'left-[18px]' : 'left-0.5')} />
              </button>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
