import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WorkoutLogger } from './WorkoutLogger'
import { WarmupChecklist } from './WarmupChecklist'

import { buildSetTargets, formatReps, targetsAreUniform } from '@/lib/setTargets'

export default async function WorkoutPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: athlete } = await supabase
    .from('athletes')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!athlete) redirect('/login')

  const { data: workout } = await supabase
    .from('workouts')
    .select('id, title, notes, warmup, workout_exercises(id, sets, reps, load, tempo, rest, notes, order, set_targets, section, exercises(id, title, category, coaching_cues, video_url))')
    .eq('id', params.id)
    .single()

  if (!workout) notFound()

  const exercises = ((workout.workout_exercises ?? []) as any[])
    .sort((a, b) => a.order - b.order)

  // Fetch existing results + warm-up progress
  const [{ data: results }, { data: warmupLog }] = await Promise.all([
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
  ])

  const warmup = (workout as any).warmup as { title?: string; items?: string[] } | null
  const warmupItems = Array.isArray(warmup?.items) ? warmup!.items! : []

  const resultMap = new Map(results?.map(r => [r.workout_exercise_id, r]) ?? [])
  const doneCount = exercises.filter((wx: any) => resultMap.get(wx.id)?.completed).length
  const status =
    exercises.length > 0 && doneCount === exercises.length ? 'done' : doneCount > 0 ? 'in_progress' : 'not_started'

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/athlete/dashboard" className="text-zinc-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{workout.title}</h1>
          {workout.notes && <p className="text-sm text-zinc-400 mt-0.5">{workout.notes}</p>}
        </div>
      </div>

      {exercises.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{doneCount} of {exercises.length} exercises complete</span>
            <Badge variant={status === 'done' ? 'green' : status === 'in_progress' ? 'blue' : 'default'}>
              {status === 'done' ? 'Done' : status === 'in_progress' ? 'In progress' : 'Not started'}
            </Badge>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${status === 'done' ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.round((doneCount / exercises.length) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {warmupItems.length > 0 && (
        <WarmupChecklist
          athleteId={athlete.id}
          workoutId={params.id}
          title={warmup?.title || 'Warm-up'}
          items={warmupItems}
          initialDone={Array.isArray(warmupLog?.done) ? (warmupLog!.done as number[]) : []}
        />
      )}

      {exercises.length > 0 ? (
        <div className="space-y-4">
          {exercises.map((wx: any, i: number) => {
            const ex = wx.exercises
            const showSection = !!wx.section && wx.section !== exercises[i - 1]?.section
            const existing = resultMap.get(wx.id)
            const targets = buildSetTargets(wx)
            const uniform = targetsAreUniform(targets)
            return (
              <div key={wx.id} className="space-y-4">
              {showSection && (
                <div className="flex items-center gap-3 pt-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                    {String(wx.section).replace(/^★\s*/, '')}
                  </h2>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>
              )}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-zinc-600 font-mono">{i + 1}.</span>
                        <CardTitle>{ex?.title}</CardTitle>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span className="text-xs text-zinc-400">{targets.length} {targets.length === 1 ? 'set' : 'sets'}</span>
                        {uniform && targets[0]?.reps && <span className="text-xs text-zinc-400">{formatReps(targets[0].reps)}</span>}
                        {uniform && targets[0]?.weight && <span className="text-xs text-zinc-400">{targets[0].weight}</span>}
                        {!uniform && <span className="text-xs text-blue-400">Targets change by set</span>}
                        {wx.tempo && <span className="text-xs text-zinc-500">Tempo: {wx.tempo}</span>}
                        {wx.rest && <span className="text-xs text-zinc-500">Rest: {wx.rest}</span>}
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
                  />
                </CardContent>
              </Card>
              </div>
            )
          })}
        </div>
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
