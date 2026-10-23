'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ListChecks, Rows3, Footprints, Repeat, CheckCircle2, Flame, PartyPopper } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EXERCISE_DONE_EVENT, type ExerciseDoneDetail } from '@/lib/rest'
import { SessionRpe, type SessionInfo } from './SessionRpe'

export interface GuidedStep {
  key: string
  kind: 'warmup' | 'single' | 'group'
  /** Section heading from the program, e.g. "PRIMARY LIFT — BACK SQUAT" */
  section: string | null
  /** Short name for the step list */
  title: string
  /** workout_exercise ids in this step (empty for warm-up) */
  exerciseIds: string[]
  /** Per exercise: label like "A1" and short name */
  labels: { id: string; tag: string; name: string }[]
  sets: number
  restLabel: string | null
}

const MODE_KEY = 'peac_workout_mode'

export function GuidedWorkout({
  steps,
  cards,
  initialDone,
  warmupDone,
  athleteId,
  workoutId,
  session,
  backHref = '/athlete/dashboard',
}: {
  steps: GuidedStep[]
  /** One rendered card per step (same order as steps) */
  cards: React.ReactNode[]
  initialDone: Record<string, boolean>
  warmupDone: boolean
  athleteId: string
  workoutId: string
  session: SessionInfo | null
  backHref?: string
}) {
  const [mode, setMode] = useState<'guided' | 'list'>('guided')
  const [done, setDone] = useState<Record<string, boolean>>(initialDone)
  const [showList, setShowList] = useState(false)
  const [finished, setFinished] = useState(false)

  // Start on the first step that isn't finished yet
  const firstOpen = useMemo(() => {
    const i = steps.findIndex(s =>
      s.kind === 'warmup' ? !warmupDone : s.exerciseIds.some(id => !initialDone[id])
    )
    return i === -1 ? 0 : i
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [index, setIndex] = useState(firstOpen)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY)
      if (saved === 'list' || saved === 'guided') setMode(saved)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    function onDone(e: Event) {
      const d = (e as CustomEvent<ExerciseDoneDetail>).detail
      setDone(prev => ({ ...prev, [d.id]: d.completed }))
    }
    window.addEventListener(EXERCISE_DONE_EVENT, onDone)
    return () => window.removeEventListener(EXERCISE_DONE_EVENT, onDone)
  }, [])

  function changeMode(m: 'guided' | 'list') {
    setMode(m)
    try { localStorage.setItem(MODE_KEY, m) } catch { /* ignore */ }
  }

  function go(i: number) {
    setFinished(false)
    setShowList(false)
    setIndex(Math.max(0, Math.min(steps.length - 1, i)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const stepDone = (s: GuidedStep) => s.kind !== 'warmup' && s.exerciseIds.length > 0 && s.exerciseIds.every(id => done[id])
  const totalEx = steps.reduce((n, s) => n + s.exerciseIds.length, 0)
  const doneEx = steps.reduce((n, s) => n + s.exerciseIds.filter(id => done[id]).length, 0)

  const step = steps[index]
  const next = steps[index + 1]
  const isLast = index === steps.length - 1

  if (steps.length === 0) return null

  return (
    <div className="space-y-4">
      {/* Mode switch */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
          <button
            onClick={() => changeMode('guided')}
            className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium', mode === 'guided' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white')}
          >
            <Footprints className="w-3.5 h-3.5" /> Step by step
          </button>
          <button
            onClick={() => changeMode('list')}
            className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium', mode === 'list' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white')}
          >
            <Rows3 className="w-3.5 h-3.5" /> Full list
          </button>
        </div>
        {mode === 'guided' && (
          <button onClick={() => setShowList(v => !v)} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
            <ListChecks className="w-4 h-4" /> {showList ? 'Hide' : 'All exercises'}
          </button>
        )}
      </div>

      {mode === 'guided' && (
        <>
          {/* Progress: one segment per step */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">
                Step <b className="text-white">{index + 1}</b> of {steps.length}
              </span>
              <span className="text-zinc-500">{doneEx}/{totalEx} exercises done</span>
            </div>
            <div className="flex gap-1">
              {steps.map((s, i) => (
                <button
                  key={s.key}
                  onClick={() => go(i)}
                  aria-label={`Go to ${s.title}`}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors',
                    i === index ? 'bg-blue-500' : stepDone(s) ? 'bg-green-500' : 'bg-zinc-800 hover:bg-zinc-700'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Jump list */}
          {showList && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800 overflow-hidden">
              {steps.map((s, i) => (
                <button
                  key={s.key}
                  onClick={() => go(i)}
                  className={cn('w-full flex items-center gap-3 px-4 py-3 text-left', i === index ? 'bg-blue-600/10' : 'hover:bg-zinc-800/50')}
                >
                  <span className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0',
                    stepDone(s) ? 'bg-green-600 text-white' : i === index ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'
                  )}>
                    {stepDone(s) ? '✓' : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-white truncate">{s.title}</span>
                    {s.kind === 'group' && <span className="block text-[11px] text-orange-300">Superset · {s.labels.length} exercises</span>}
                  </span>
                </button>
              ))}
            </div>
          )}

          {finished ? (
            <div className="rounded-2xl border border-green-600/40 bg-green-600/10 p-6 text-center space-y-3">
              <PartyPopper className="w-10 h-10 text-green-400 mx-auto" />
              <h2 className="text-xl font-bold text-white">
                {doneEx === totalEx ? 'Workout complete!' : 'Nice work!'}
              </h2>
              <p className="text-sm text-zinc-300">
                {doneEx} of {totalEx} exercises done.
                {doneEx < totalEx && ' You can go back and finish the rest any time today.'}
              </p>
              <SessionRpe athleteId={athleteId} workoutId={workoutId} initial={session} />
              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                <button onClick={() => go(index)} className="px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200">Back to workout</button>
                <Link href={backHref} className="px-4 py-2.5 rounded-lg bg-green-600 text-sm font-medium text-white">Done — go home</Link>
              </div>
            </div>
          ) : (
            <StepIntro step={step} />
          )}
        </>
      )}

      {/* Cards: all stay mounted so typed numbers aren't lost when moving between steps */}
      {steps.map((s, i) => (
        <div key={s.key} className={cn(mode === 'guided' && (i !== index || finished) && 'hidden', 'space-y-4')}>
          {mode === 'list' && s.section && s.section !== steps[i - 1]?.section && (
            <div className="flex items-center gap-3 pt-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-blue-400">{s.section}</h2>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
          )}
          {mode === 'list' && s.kind === 'group' && <GroupBanner step={s} compact />}
          {cards[i]}
        </div>
      ))}

      {mode === 'list' && <SessionRpe athleteId={athleteId} workoutId={workoutId} initial={session} />}

      {/* Back / Next */}
      {mode === 'guided' && !finished && (
        <div className="grid grid-cols-[auto_1fr] gap-2 pt-2">
          <button
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="flex items-center justify-center gap-1 px-4 py-3.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm font-medium text-zinc-300 disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" /> Back
          </button>
          <button
            onClick={() => (isLast ? setFinished(true) : go(index + 1))}
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-semibold min-w-0',
              isLast
                ? 'bg-green-600 text-white hover:bg-green-700'
                : step && (step.kind === 'warmup' || stepDone(step))
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-zinc-800 border border-zinc-700 text-white hover:border-zinc-500'
            )}
          >
            {isLast ? (
              <><CheckCircle2 className="w-5 h-5" /> Finish workout</>
            ) : (
              <>
                <span className="truncate">Next: {next?.title}</span>
                <ChevronRight className="w-5 h-5 shrink-0" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

function StepIntro({ step }: { step: GuidedStep }) {
  return (
    <div className="space-y-3">
      {step.section && (
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">{step.section}</p>
      )}
      {step.kind === 'warmup' ? (
        <Instruction icon={<Flame className="w-4 h-4 text-orange-400" />}>
          Start with the warm-up. Check off each item as you go, then tap <b>Next</b>.
        </Instruction>
      ) : step.kind === 'group' ? (
        <GroupBanner step={step} />
      ) : (
        <Instruction icon={<Repeat className="w-4 h-4 text-blue-400" />}>
          Do all <b>{step.sets} {step.sets === 1 ? 'set' : 'sets'}</b> of this exercise
          {step.restLabel ? <>, resting <b>{step.restLabel}</b> between sets</> : <>, resting between sets</>}
          . Tap ✓ after each set, then go to the next exercise.
        </Instruction>
      )}
    </div>
  )
}

function GroupBanner({ step, compact = false }: { step: GuidedStep; compact?: boolean }) {
  const order = step.labels.map(l => l.tag).join(' → ')
  return (
    <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold text-orange-200">
        <Repeat className="w-4 h-4" /> Superset — rotate through these {step.labels.length}
      </p>
      {!compact && (
        <ol className="space-y-1">
          {step.labels.map(l => (
            <li key={l.id} className="flex items-center gap-2 text-sm text-zinc-200">
              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-200">{l.tag}</span>
              <span className="truncate">{l.name}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-orange-100/80">
        Do <b>1 set of each</b> in order ({order}) with little rest, then rest
        {step.restLabel ? <> <b>{step.restLabel}</b></> : ' 2–3 min'}. That&apos;s one round. Repeat for{' '}
        <b>{step.sets} {step.sets === 1 ? 'round' : 'rounds'}</b>, checking off Set 1 on each, then Set 2, and so on.
      </p>
    </div>
  )
}

function Instruction({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  )
}
