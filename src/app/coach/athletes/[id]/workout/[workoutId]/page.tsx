import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, ClipboardList, Flame } from 'lucide-react'
import { SetLogEditor } from './SetLogEditor'
import { ClearWorkoutButton } from './ClearWorkoutButton'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { buildSetTargets, type AthleteMaxes } from '@/lib/setTargets'
import { toLocalISO, formatShortDate } from '@/lib/schedule'
import type { LiftKey } from '@/lib/maxes'


export default async function CoachWorkoutView({ params }: { params: { id: string; workoutId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: athlete }, { data: workout }] = await Promise.all([
    supabase.from('athletes').select('id, name').eq('id', params.id).single(),
    supabase
      .from('workouts')
      .select('id, title, warmup, training_blocks(week_number, title), workout_exercises(id, sets, reps, load, notes, order, set_targets, section, max_lift, ref_max, exercises(title, category))')
      .eq('id', params.workoutId)
      .single(),
  ])
  if (!athlete || !workout) notFound()

  const [{ data: results }, { data: warmupLog }, { data: maxRows }] = await Promise.all([
    supabase.from('workout_results').select('*').eq('athlete_id', params.id).eq('workout_id', params.workoutId),
    supabase.from('warmup_logs').select('done').eq('athlete_id', params.id).eq('workout_id', params.workoutId).maybeSingle(),
    supabase.from('athlete_maxes').select('lift, value').eq('athlete_id', params.id),
  ])

  const maxes: AthleteMaxes = {}
  ;(maxRows ?? []).forEach((m: any) => { maxes[m.lift as LiftKey] = Number(m.value) })

  const resultMap = new Map((results ?? []).map((r: any) => [r.workout_exercise_id, r]))
  const exercises = ((workout.workout_exercises ?? []) as any[]).sort((a, b) => a.order - b.order)
  const doneCount = exercises.filter(wx => resultMap.get(wx.id)?.completed).length
  const lastLogged = (results ?? []).map((r: any) => r.logged_at as string).sort().pop()
  const block = (workout as any).training_blocks
  const warmupItems: string[] = Array.isArray((workout as any).warmup?.items) ? (workout as any).warmup.items : []
  const warmupDone: number[] = Array.isArray(warmupLog?.done) ? (warmupLog!.done as number[]) : []

  const status = exercises.length > 0 && doneCount === exercises.length ? 'done' : doneCount > 0 ? 'in_progress' : 'not_started'

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start gap-3">
        <Link href={`/coach/athletes/${params.id}`} className="text-zinc-400 hover:text-white mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <p className="text-sm text-blue-400">{athlete.name}{block?.week_number ? ` · Week ${block.week_number}` : ''}</p>
          <h1 className="text-xl font-bold">{workout.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-zinc-400">
            <Badge variant={status === 'done' ? 'green' : status === 'in_progress' ? 'blue' : 'default'}>
              {status === 'done' ? 'Done' : status === 'in_progress' ? 'In progress' : 'Not started'}
            </Badge>
            <span>{doneCount} of {exercises.length} exercises complete</span>
            {lastLogged && <span>· Last logged {formatShortDate(toLocalISO(lastLogged))}</span>}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <ClearWorkoutButton athleteId={params.id} workoutId={params.workoutId} />
      </div>

      {warmupItems.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Flame className="w-4 h-4 text-orange-400" />
          Warm-up: {warmupDone.length} of {warmupItems.length} items checked off
        </div>
      )}

      <div className="space-y-4">
        {exercises.map((wx, i) => {
          const result = resultMap.get(wx.id)
          const targets = buildSetTargets(wx, maxes)
          const logs: any[] = Array.isArray(result?.set_logs) ? result.set_logs : []
          const showSection = !!wx.section && wx.section !== exercises[i - 1]?.section

          return (
            <div key={wx.id} className="space-y-3">
              {showSection && (
                <div className="flex items-center gap-3 pt-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-blue-400">{String(wx.section).replace(/^★\s*/, '')}</h2>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>
              )}
              <Card className={cn(result?.completed && 'border-green-600/30')}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle>{i + 1}. {wx.exercises?.title}</CardTitle>
                    {wx.notes && (
                      <p className="flex items-start gap-1.5 text-xs text-zinc-500 mt-1.5">
                        <ClipboardList className="w-3.5 h-3.5 mt-px shrink-0" /> {wx.notes}
                      </p>
                    )}
                  </div>
                  {result?.completed
                    ? <Badge variant="green" className="shrink-0">Completed</Badge>
                    : logs.some(l => l?.done) ? <Badge variant="blue" className="shrink-0">Partial</Badge>
                    : <Badge className="shrink-0">Not logged</Badge>}
                </CardHeader>
                <CardContent className="pt-0">
                  <SetLogEditor
                    athleteId={params.id}
                    workoutId={params.workoutId}
                    workoutExerciseId={wx.id}
                    targets={targets}
                    initialLogs={
                      logs.length > 0
                        ? logs.map((l: any) => ({ weight: l?.weight ?? null, reps: l?.reps ?? null, done: !!l?.done }))
                        : result && (result.weight_used != null || result.reps_completed != null)
                          ? [{ weight: result.weight_used, reps: result.reps_completed, done: !!result.completed }]
                          : result?.completed ? targets.map(() => ({ weight: null, reps: null, done: true })) : []
                    }
                    initialNotes={result?.notes ?? ''}
                    initialCompleted={!!result?.completed}
                    hasResult={!!result}
                  />
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>
    </div>
  )
}
