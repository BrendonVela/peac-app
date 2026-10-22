import { createClient } from '@/lib/supabase/server'
import { athleteMatch } from '@/lib/acting'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WorkoutLogger } from './WorkoutLogger'
import { WarmupChecklist } from './WarmupChecklist'
import { RestTimer } from './RestTimer'
import { GuidedWorkout, type GuidedStep } from './GuidedWorkout'
import { restForExercise, restFromText } from '@/lib/rest'

import { buildSetTargets, formatReps, targetsAreUniform, maxRatio, type AthleteMaxes } from '@/lib/setTargets'
import { LIFT_LABEL, type LiftKey } from '@/lib/maxes'

export default async function WorkoutPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: athlete } = await supabase
    .from('athletes')
    .select('id')
    .match(await athleteMatch(supabase, user.id))
    .single()

  if (!athlete) redirect('/login')

  const { data: workout } = await supabase
    .from('workouts')
    .select('id, title, notes, warmup, workout_exercises(id, sets, reps, load, tempo, rest, notes, order, set_targets, section, max_lift, ref_max, exercises(id, title, category, coaching_cues, video_url))')
    .eq('id', params.id)
    .single()

  if (!workout) notFound()

  const exercises = ((workout.workout_exercises ?? []) as any[])
    .sort((a, b) => a.order - b.order)

  // Fetch existing results + warm-up progress
  const [{ data: results }, { data: warmupLog }, { data: maxRows }, { data: history }] = await Promise.all([
    supabase
      .from('workout_results')
      .select('*')
      .eq('athlete_id', athlete.id)
      .eq('workout_id', params.id),
    supabase
      .from('warmup_logs')
      .select('done')
      .eq('athlete_id', athlete.id)
      .eq('workout_id', params.id)
      .maybeSingle(),
    supabase
      .from('athlete_maxes')
      .select('lift, value')
      .eq('athlete_id', athlete.id),
    // Earlier logs of the same exercises, for "Last time" numbers
    supabase
      .from('workout_results')
      .select('workout_id, set_logs, weight_used, reps_completed, logged_at, workout_exercises(exercise_id)')
      .eq('athlete_id', athlete.id)
      .neq('workout_id', params.id)
      .order('logged_at', { ascending: false })
      .limit(500),
  ])

  // exercise_id -> most recent earlier log that has numbers in it
  const lastTime = new Map<string, { date: string; sets: { weight: number | null; reps: number | null }[] }>()
  ;(history ?? []).forEach((h: any) => {
    const exId = h.workout_exercises?.exercise_id
    if (!exId || lastTime.has(exId)) return
    let sets: { weight: number | null; reps: number | null }[] = Array.isArray(h.set_logs)
      ? h.set_logs.map((l: any) => ({ weight: l?.weight ?? null, reps: l?.reps ?? null }))
      : []
    if (sets.length === 0 && (h.weight_used != null || h.reps_completed != null)) {
      sets = [{ weight: h.weight_used, reps: h.reps_completed }]
    }
    if (sets.some(x => x.weight != null || x.reps != null)) {
      lastTime.set(exId, { date: h.logged_at, sets })
    }
  })

  const maxes: AthleteMaxes = {}
  ;(maxRows ?? []).forEach((m: any) => { maxes[m.lift as LiftKey] = Number(m.value) })

  const warmup = (workout as any).warmup as { title?: string; items?: string[] } | null
  const warmupItems = Array.isArray(warmup?.items) ? warmup!.items! : []

  const resultMap = new Map(results?.map(r => [r.workout_exercise_id, r]) ?? [])
  const doneCount = exercises.filter((wx: any) => resultMap.get(wx.id)?.completed).length
  const status =
    exercises.length > 0 && doneCount === exercises.length ? 'done' : doneCount > 0 ? 'in_progress' : 'not_started'

  // ---------- Build the step-by-step flow ----------
  const cleanSection = (sec: string | null) => (sec ? String(sec).replace(/^★\s*/, '').trim() : null)
  const isGroupSection = (sec: string | null) => !!sec && /COMPLEX|SUPERSET|SUPER SET|CIRCUIT|TRI-?SET|GIANT SET/i.test(sec)

  const renderExercise = (wx: any, i: number, tag: string | null, autoRest = true) => {
    const ex = wx.exercises
    const existing = resultMap.get(wx.id)
    const targets = buildSetTargets(wx, maxes)
    const personalized = maxRatio(wx, maxes) !== 1
    const rest = restForExercise(wx)
    const uniform = targetsAreUniform(targets)
    return (
      <Card key={wx.id}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {tag ? (
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-200">{tag}</span>
                ) : (
                  <span className="text-xs text-zinc-600 font-mono">{i + 1}.</span>
                )}
                <CardTitle>{ex?.title}</CardTitle>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-xs text-zinc-400">{targets.length} {targets.length === 1 ? 'set' : 'sets'}</span>
                {uniform && targets[0]?.reps && <span className="text-xs text-zinc-400">{formatReps(targets[0].reps)}</span>}
                {uniform && targets[0]?.weight && <span className="text-xs text-zinc-400">{targets[0].weight}</span>}
                {!uniform && <span className="text-xs text-blue-400">Targets change by set</span>}
                {personalized && (
                  <span className="text-xs text-emerald-400">
                    Set from your {LIFT_LABEL[wx.max_lift as LiftKey]} max ({maxes[wx.max_lift as LiftKey]} lb)
                  </span>
                )}
                {wx.tempo && <span className="text-xs text-zinc-500">Tempo: {wx.tempo}</span>}
                {rest.label && <span className="text-xs text-zinc-500">Rest: {rest.label}</span>}
              </div>
              {wx.notes && (
                <p className="flex items-start gap-1.5 text-xs text-amber-200/80 mt-2">
                  <ClipboardList className="w-3.5 h-3.5 mt-px shrink-0 text-amber-400" />
                  <span>{wx.notes}</span>
                </p>
              )}
              {ex?.coaching_cues && (
                <p className="text-xs text-zinc-500 italic mt-1">&ldquo;{ex.coaching_cues}&rdquo;</p>
              )}
            </div>
            {ex?.category && <Badge variant="default">{ex.category}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <WorkoutLogger
            workoutExerciseId={wx.id}
            workoutId={params.id}
            athleteId={athlete.id}
            targets={targets}
            initialSetLogs={existing?.set_logs ?? null}
            initialWeight={existing?.weight_used ?? undefined}
            initialReps={existing?.reps_completed ?? undefined}
            initialCompleted={existing?.completed ?? false}
            initialNotes={existing?.notes ?? ''}
            videoUrl={ex?.video_url}
            lastTime={ex?.id ? lastTime.get(ex.id) ?? null : null}
            restSeconds={rest.seconds}
            restLabel={rest.label}
            exerciseTitle={ex?.title ?? 'Exercise'}
            autoRest={autoRest}
          />
        </CardContent>
      </Card>
    )
  }

  const steps: GuidedStep[] = []
  const cards: React.ReactNode[] = []

  if (warmupItems.length > 0) {
    steps.push({
      key: 'warmup', kind: 'warmup', section: null, title: warmup?.title || 'Warm-up',
      exerciseIds: [], labels: [], sets: 0, restLabel: null,
    })
    cards.push(
      <WarmupChecklist
        key="warmup"
        athleteId={athlete.id}
        workoutId={params.id}
        title={warmup?.title || 'Warm-up'}
        items={warmupItems}
        initialDone={Array.isArray(warmupLog?.done) ? (warmupLog!.done as number[]) : []}
      />
    )
  }

  let groupCount = 0
  for (let i = 0; i < exercises.length; ) {
    const wx: any = exercises[i]
    const sec = wx.section ?? null
    // Exercises that share a "COMPLEX / SUPERSET" section are done back-to-back
    let j = i + 1
    if (isGroupSection(sec)) {
      while (j < exercises.length && (exercises[j] as any).section === sec) j++
    }
    const members = exercises.slice(i, j) as any[]
    const section = cleanSection(sec)
    if (members.length > 1) {
      const letterMatch = section?.match(/(?:COMPLEX|SUPERSET|CIRCUIT)\s+([A-Z])\b/i)
      const letter = (letterMatch?.[1] ?? String.fromCharCode(65 + groupCount)).toUpperCase()
      groupCount++
      const labels = members.map((m, k) => ({ id: m.id, tag: `${letter}${k + 1}`, name: m.exercises?.title ?? 'Exercise' }))
      const sets = Math.max(...members.map(m => buildSetTargets(m, maxes).length))
      const restLabel = restFromText(section)?.label ?? null
      steps.push({
        key: `g-${wx.id}`, kind: 'group', section,
        title: `Superset ${letter}: ${labels.map(l => l.name.split(/[—(]/)[0].trim()).join(' + ')}`,
        exerciseIds: members.map(m => m.id), labels, sets, restLabel,
      })
      cards.push(
        <div key={`g-${wx.id}`} className="space-y-3 border-l-2 border-orange-500/50 pl-3">
          {members.map((m, k) => renderExercise(m, i + k, labels[k].tag, k === members.length - 1))}
        </div>
      )
    } else {
      const targets = buildSetTargets(wx, maxes)
      steps.push({
        key: wx.id, kind: 'single', section,
        title: wx.exercises?.title ?? 'Exercise',
        exerciseIds: [wx.id], labels: [], sets: targets.length, restLabel: restForExercise(wx).label,
      })
      cards.push(renderExercise(wx, i, null))
    }
    i = j
  }

  const initialDone: Record<string, boolean> = {}
  exercises.forEach((wx: any) => { initialDone[wx.id] = !!resultMap.get(wx.id)?.completed })
  const warmupDone = warmupItems.length > 0 && Array.isArray(warmupLog?.done) && (warmupLog!.done as number[]).length >= warmupItems.length

  return (
    <div className="space-y-6 max-w-2xl pb-40">
      <RestTimer />
      <div className="flex items-center gap-3">
        <Link href="/athlete/dashboard" className="text-zinc-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{workout.title}</h1>
          {workout.notes && <p className="text-sm text-zinc-400 mt-0.5">{workout.notes}</p>}
        </div>
      </div>

      {exercises.length > 0 || warmupItems.length > 0 ? (
        <GuidedWorkout steps={steps} cards={cards} initialDone={initialDone} warmupDone={warmupDone} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-zinc-500">
            No exercises in this workout.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
