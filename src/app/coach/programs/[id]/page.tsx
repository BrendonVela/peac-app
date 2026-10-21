import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { deleteProgram } from '@/app/actions/programs'
import { AssignProgramForm } from './AssignProgramForm'
import { ProgramTools } from './ProgramTools'
import { EditExerciseButton } from './EditExerciseButton'
import { LIFT_LABEL, type LiftKey } from '@/lib/maxes'
import { ExerciseVideo } from '@/components/ExerciseVideo'

// "8" -> "8 reps", but "8 reps" or "20yd" stays as-is
function formatReps(reps: string): string {
  const r = String(reps).trim()
  if (/^\d+$/.test(r)) return `${r} reps`
  return r
}

export default async function ProgramDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: coach } = await supabase.from('coaches').select('id').match(await coachMatch(supabase, user.id)).single()
  if (!coach) redirect('/login')

  const { data: program } = await supabase
    .from('programs')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!program) notFound()

  const [{ data: blocks }, { data: athletes }, { data: assignments }] = await Promise.all([
    supabase
      .from('training_blocks')
      .select('id, title, week_number, order, workouts(id, title, day_of_week, notes, warmup, workout_exercises(id, sets, reps, load, tempo, rest, notes, order, set_targets, section, max_lift, ref_max, exercises(title, category, video_url)))')
      .eq('program_id', params.id)
      .order('order'),
    supabase.from('athletes').select('id, name, sport').eq('coach_id', coach.id),
    supabase.from('program_assignments').select('athlete_id').eq('program_id', params.id),
  ])

  const assignedIds = new Set(assignments?.map(a => a.athlete_id) ?? [])

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/coach/programs" className="text-zinc-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{program.title}</h1>
          {program.description && (
            <p className="text-sm text-zinc-400 mt-1">{program.description}</p>
          )}
        </div>
        <form action={deleteProgram.bind(null, params.id) as unknown as (formData: FormData) => void}>
          <button type="submit" className="text-zinc-600 hover:text-red-400 transition-colors p-1" title="Delete program">
            <Trash2 className="w-4 h-4" />
          </button>
        </form>
      </div>

      <ProgramTools programId={params.id} athletes={(athletes ?? []).map(a => ({ id: a.id, name: a.name }))} />

      {/* Assign Athletes */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Athletes</CardTitle>
        </CardHeader>
        <CardContent>
          <AssignProgramForm
            programId={params.id}
            athletes={athletes ?? []}
            assignedIds={Array.from(assignedIds)}
          />
        </CardContent>
      </Card>

      {/* Training Blocks */}
      {blocks && blocks.length > 0 ? (
        <div className="space-y-4">
          {blocks.map(block => {
            const workouts = ((block.workouts as any[]) ?? []).sort(
              (a: any, b: any) => (a.day_of_week ?? 0) - (b.day_of_week ?? 0)
            )
            return (
              <Card key={block.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Badge variant="blue">Week {block.week_number}</Badge>
                    <CardTitle>{block.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  {workouts.length > 0 ? (
                    workouts.map((workout: any, wIdx: number) => {
                      const wxs = (workout.workout_exercises ?? []).sort((a: any, b: any) => a.order - b.order)
                      return (
                        <div key={workout.id} className="border border-zinc-800 rounded-xl overflow-hidden">
                          <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800/30">
                            <span className="text-sm font-semibold text-white">{workout.title}</span>
                            <Badge>Day {wIdx + 1}</Badge>
                          </div>

                          {Array.isArray(workout.warmup?.items) && workout.warmup.items.length > 0 && (
                            <details className="border-b border-zinc-800 group">
                              <summary className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-orange-400 cursor-pointer select-none hover:bg-zinc-800/30">
                                {workout.warmup.title || 'Warm-up'} · {workout.warmup.items.length} items
                              </summary>
                              <ol className="px-4 pb-3 space-y-1 list-decimal list-inside text-xs text-zinc-400">
                                {workout.warmup.items.map((item: string, k: number) => (
                                  <li key={k}>{item}</li>
                                ))}
                              </ol>
                            </details>
                          )}

                          {wxs.length > 0 ? (
                            <div className="divide-y divide-zinc-800">
                              {wxs.map((wx: any, i: number) => (
                                <div key={wx.id}>
                                {wx.section && wx.section !== wxs[i - 1]?.section && (
                                  <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                                    {String(wx.section).replace(/^★\s*/, '')}
                                  </div>
                                )}
                                <div className="flex items-start gap-4 px-4 py-3">
                                  <span className="text-xs text-zinc-600 font-mono w-5 shrink-0 mt-0.5">{i + 1}.</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white">{wx.exercises?.title}</p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                      {wx.sets && <span className="text-xs text-zinc-400">{wx.sets} sets</span>}
                                      {wx.reps && <span className="text-xs text-zinc-400">{formatReps(wx.reps)}</span>}
                                      {wx.load && <span className="text-xs text-zinc-400">{wx.load}</span>}
                                      {wx.tempo && <span className="text-xs text-zinc-500">Tempo: {wx.tempo}</span>}
                                      {wx.rest && <span className="text-xs text-zinc-500">Rest: {wx.rest}</span>}
                                    </div>
                                    {Array.isArray(wx.set_targets) && wx.set_targets.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        {wx.set_targets.map((t: any, k: number) => (
                                          <span key={k} className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                                            {t.label}: {[t.weight, t.reps].filter(Boolean).join(' × ')}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {wx.max_lift && wx.ref_max && (
                                      <p className="text-[11px] text-emerald-400 mt-1">
                                        Scales with {LIFT_LABEL[wx.max_lift as LiftKey]} max (written for {Number(wx.ref_max)} lb)
                                      </p>
                                    )}
                                    {wx.notes && <p className="text-xs text-zinc-500 mt-1 italic">{wx.notes}</p>}
                                    <ExerciseVideo url={wx.exercises?.video_url} title={wx.exercises?.title} />
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {wx.exercises?.category && (
                                      <Badge variant="default">{wx.exercises.category}</Badge>
                                    )}
                                    <EditExerciseButton programId={params.id} wx={wx} title={wx.exercises?.title ?? 'Exercise'} />
                                  </div>
                                </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="px-4 py-3 text-xs text-zinc-600">No exercises added</p>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-sm text-zinc-500">No workouts in this block.</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-zinc-500">
            No training blocks in this program.
          </CardContent>
        </Card>
      )}
    </div>
  )
}