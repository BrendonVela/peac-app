'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, Check, Play, X, VideoOff, ExternalLink, Timer, Shuffle } from 'lucide-react'
import { formatClock, REST_START_EVENT, SET_DONE_EVENT, EXERCISE_DONE_EVENT, type RestEventDetail } from '@/lib/rest'
import { saveOrQueue } from '@/lib/offlineQueue'
import { FormVideoButton } from './FormVideoButton'
import { cn } from '@/lib/utils'

function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|studio\.youtube\.com\/video\/)([a-zA-Z0-9_-]{11})/
  )
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

export interface SetTarget {
  label: string
  weight: string | null
  reps: string | null
}

export interface SetLog {
  weight: number | null
  reps: number | null
  done: boolean
}

/** First number in a target, e.g. "210lb" -> 210, "5 ea" -> 5, "BW" -> null */
function firstNumber(text: string | null): string {
  if (!text) return ''
  const m = String(text).match(/\d+(\.\d+)?/)
  return m ? m[0] : ''
}

function targetText(t: SetTarget): string {
  const parts = [t.weight, t.reps].filter(Boolean)
  return parts.length ? parts.join(' × ') : '—'
}

interface Props {
  workoutExerciseId: string
  workoutId: string
  athleteId: string
  targets: SetTarget[]
  initialSetLogs?: SetLog[] | null
  initialWeight?: number
  initialReps?: number
  initialCompleted: boolean
  initialNotes: string
  videoUrl?: string | null
  lastTime?: { date: string; sets: { weight: number | null; reps: number | null }[] } | null
  restSeconds?: number
  restLabel?: string | null
  exerciseTitle?: string
  /** false inside a superset (except the last exercise) so the timer doesn't start between A1 and A2 */
  autoRest?: boolean
  /** Exercises the coach allows instead of this one */
  alternatives?: { id: string; title: string; video_url: string | null }[]
  initialSwapId?: string | null
  /** Show the 'Send video to coach' button (athlete only) */
  canSendVideo?: boolean
}

function fireRest(eventName: string, detail: RestEventDetail) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }))
}

function formatLast(s: { weight: number | null; reps: number | null } | undefined): string | null {
  if (!s || (s.weight == null && s.reps == null)) return null
  if (s.weight != null && s.reps != null) return `${s.weight} × ${s.reps}`
  return s.weight != null ? `${s.weight} lb` : `${s.reps} reps`
}

function daysAgoLabel(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type Row = { weight: string; reps: string; done: boolean }

export function WorkoutLogger({
  workoutExerciseId, workoutId, athleteId, targets,
  initialSetLogs, initialWeight, initialReps, initialCompleted, initialNotes, videoUrl, lastTime,
  restSeconds = 90, restLabel = null, exerciseTitle = 'Exercise', autoRest = true,
  alternatives = [], initialSwapId = null, canSendVideo = false,
}: Props) {
  const setCount = Math.max(1, targets.length)

  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: setCount }, (_, i) => {
      const saved = initialSetLogs?.[i]
      if (saved) {
        return {
          weight: saved.weight != null ? String(saved.weight) : '',
          reps: saved.reps != null ? String(saved.reps) : '',
          done: !!saved.done,
        }
      }
      // Older results logged before per-set tracking
      return {
        weight: i === 0 && initialWeight != null ? String(initialWeight) : '',
        reps: i === 0 && initialReps != null ? String(initialReps) : '',
        done: initialCompleted,
      }
    })
  )
  const [notes, setNotes] = useState(initialNotes)
  const [completed, setCompleted] = useState(initialCompleted)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const [offline, setOffline] = useState(false)

  const [swapId, setSwapId] = useState<string | null>(initialSwapId)
  const [showSwaps, setShowSwaps] = useState(false)
  const swapped = alternatives.find(a => a.id === swapId) ?? null
  const shownVideo = swapped ? swapped.video_url : videoUrl
  const shownTitle = swapped ? swapped.title : exerciseTitle

  async function chooseSwap(id: string | null) {
    setShowSwaps(false)
    setSwapId(id)
    setShowVideo(false)
    await saveOrQueue('setWorkoutSwap', [athleteId, workoutId, workoutExerciseId, id], `${athleteId}:${workoutExerciseId}`)
  }

  const embedUrl = shownVideo ? getYouTubeEmbedUrl(shownVideo) : null
  const doneSets = rows.filter(r => r.done).length

  async function persist(nextRows: Row[], isCompleted: boolean) {
    setSaving(true)
    setCompleted(isCompleted)
    window.dispatchEvent(new CustomEvent(EXERCISE_DONE_EVENT, { detail: { id: workoutExerciseId, completed: isCompleted } }))

    const setLogs: SetLog[] = nextRows.map(r => ({
      weight: r.weight !== '' ? parseFloat(r.weight) : null,
      reps: r.reps !== '' ? parseInt(r.reps) : null,
      done: r.done,
    }))
    // Summary values: the heaviest set logged
    const best = setLogs
      .filter(l => l.weight != null || l.reps != null)
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0]

    const how = await saveOrQueue('logWorkoutResult', [athleteId, workoutId, workoutExerciseId, {
      weight_used: best?.weight ?? undefined,
      reps_completed: best?.reps ?? undefined,
      completed: isCompleted,
      notes: notes || undefined,
      set_logs: setLogs,
    }], `${athleteId}:${workoutExerciseId}`)
    setSaving(false)
    setSaved(true)
    setOffline(how === 'queued')
    setTimeout(() => setSaved(false), 2000)
  }

  function fillFromTarget(row: Row, i: number): Row {
    const t = targets[i]
    return {
      ...row,
      weight: row.weight !== '' ? row.weight : firstNumber(t?.weight ?? null),
      reps: row.reps !== '' ? row.reps : firstNumber(t?.reps ?? null),
    }
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function toggleSet(i: number) {
    const wasDone = rows[i]?.done
    const next = rows.map((r, idx) => {
      if (idx !== i) return r
      return r.done ? { ...r, done: false } : { ...fillFromTarget(r, idx), done: true }
    })
    setRows(next)
    persist(next, next.every(r => r.done))
    // Only starts if the athlete switched on auto-start in the timer
    if (autoRest && !wasDone && !next.every(r => r.done)) fireRest(SET_DONE_EVENT, { seconds: restSeconds, title: exerciseTitle })
  }

  function toggleAll() {
    const next = completed
      ? rows.map(r => ({ ...r, done: false }))
      : rows.map((r, idx) => ({ ...fillFromTarget(r, idx), done: true }))
    setRows(next)
    persist(next, !completed)
  }

  const lastSummary = lastTime ? lastTime.sets.map(formatLast).filter(Boolean).join(', ') : ''

  return (
    <div className="space-y-3">
      {swapped && (
        <div className="flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm">
          <Shuffle className="w-4 h-4 text-violet-300 shrink-0" />
          <span className="flex-1 min-w-0 text-violet-100">Doing instead: <b>{swapped.title}</b></span>
          <button onClick={() => chooseSwap(null)} className="text-xs text-violet-300 hover:text-white">Undo</button>
        </div>
      )}
      {showSwaps && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 divide-y divide-zinc-800 overflow-hidden">
          <p className="px-3 py-2 text-xs text-zinc-400">Equipment taken or something doesn&apos;t feel right? Your coach allows:</p>
          {swapId && (
            <button onClick={() => chooseSwap(null)} className="w-full px-3 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800">
              ↩ Back to {exerciseTitle}
            </button>
          )}
          {alternatives.filter(a => a.id !== swapId).map(a => (
            <button key={a.id} onClick={() => chooseSwap(a.id)} className="w-full px-3 py-2.5 text-left text-sm text-white hover:bg-zinc-800">
              {a.title}
            </button>
          ))}
        </div>
      )}
      {lastTime && lastSummary && !swapped && (
        <p className="text-xs text-violet-300/90">
          <span className="text-zinc-500">Last time ({daysAgoLabel(lastTime.date)}):</span> {lastSummary}
        </p>
      )}

      {/* Sets */}
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-[1fr_76px_64px_40px] gap-2 px-3 py-1.5 bg-zinc-800/40 text-[10px] uppercase font-medium text-zinc-500">
          <span>Set · Target</span>
          <span>Lbs</span>
          <span>Reps</span>
          <span className="text-center">Done</span>
        </div>
        <div className="divide-y divide-zinc-800">
          {rows.map((row, i) => {
            const t = targets[i] ?? { label: `Set ${i + 1}`, weight: null, reps: null }
            return (
              <div
                key={i}
                className={cn(
                  'grid grid-cols-[1fr_76px_64px_40px] gap-2 items-center px-3 py-2 transition-colors',
                  row.done && 'bg-green-500/[0.06]'
                )}
              >
                <div className="min-w-0">
                  <p className={cn('text-xs font-medium', row.done ? 'text-green-400' : 'text-zinc-300')}>{t.label}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{targetText(t)}</p>
                  {formatLast(lastTime?.sets[i]) && (
                    <p className="text-[11px] text-violet-300/80 truncate">Last: {formatLast(lastTime?.sets[i])}</p>
                  )}
                </div>
                <input
                  value={row.weight}
                  onChange={e => updateRow(i, { weight: e.target.value })}
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  placeholder={firstNumber(t.weight) || '—'}
                  aria-label={`${t.label} weight`}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={row.reps}
                  onChange={e => updateRow(i, { reps: e.target.value })}
                  type="number"
                  inputMode="numeric"
                  placeholder={firstNumber(t.reps) || '—'}
                  aria-label={`${t.label} reps`}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => toggleSet(i)}
                  disabled={saving}
                  aria-label={row.done ? `Undo ${t.label}` : `Complete ${t.label}`}
                  className={cn(
                    'mx-auto w-8 h-8 rounded-md border flex items-center justify-center transition-colors',
                    row.done
                      ? 'bg-green-600 border-green-600 text-white hover:bg-green-700'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500'
                  )}
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-[11px] text-zinc-500">
        Tap ✓ when a set is done. Leave the boxes empty to log it exactly as prescribed.
      </p>

      <input
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Buttons row */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={toggleAll}
          disabled={saving}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
            completed
              ? 'bg-green-600/20 border border-green-600/40 text-green-400 hover:bg-green-600/30'
              : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600'
          )}
        >
          {completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
          {completed ? 'Completed' : doneSets > 0 ? `${doneSets}/${rows.length} sets · Finish all` : 'Mark all complete'}
        </button>

        <button
          onClick={() => persist(rows, completed)}
          disabled={saving}
          className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-all whitespace-nowrap"
        >
          {saving ? 'Saving…' : saved ? (offline ? '✓ Saved on phone' : '✓ Saved') : 'Save'}
        </button>

        <button
          onClick={() => fireRest(REST_START_EVENT, { seconds: restSeconds, title: shownTitle })}
          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-all whitespace-nowrap"
          title={restLabel ? `Coach: rest ${restLabel}` : 'Start a rest timer'}
        >
          <Timer className="w-4 h-4" />
          Rest {formatClock(restSeconds)}
        </button>

        {alternatives.length > 0 && (
          <button
            onClick={() => setShowSwaps(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-violet-300 hover:text-white hover:border-zinc-600 whitespace-nowrap"
          >
            <Shuffle className="w-4 h-4" /> Swap
          </button>
        )}

        {canSendVideo && <FormVideoButton exerciseTitle={shownTitle} />}

        {/* Video control (right side) */}
        <div className="ml-auto">
          {!shownVideo ? (
            <span className="flex items-center gap-1.5 text-sm text-amber-400">
              <VideoOff className="w-3.5 h-3.5" />
              No video
            </span>
          ) : embedUrl ? (
            <button
              onClick={() => setShowVideo(!showVideo)}
              className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 whitespace-nowrap"
            >
              {showVideo ? <X className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {showVideo ? 'Hide demo' : 'Watch demo'}
            </button>
          ) : (
            <a
              href={shownVideo}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Watch demo
            </a>
          )}
        </div>
      </div>

      {/* Video: full width, below the buttons */}
      {showVideo && embedUrl && (
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-zinc-800">
          <iframe
            src={embedUrl}
            title="Exercise demo"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  )
}
