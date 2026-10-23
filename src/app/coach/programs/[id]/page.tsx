import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { deleteProgram } from '@/app/actions/programs'
import { AssignProgramForm } from './AssignProgramForm'
import { ProgramTools } from './ProgramTools'
import { EditExerciseButton } from './EditExerciseButton'
import { SaveAsTemplateButton, UseTemplateButton, TemplateOwnerButtons } from '../TemplateButtons'
import { ExerciseControls, AddExerciseButton, DayControls, AddDayButton, WeekControls, AddWeekButton } from './EditorControls'
import { LIFT_LABEL, type LiftKey } from '@/lib/maxes'
import { ExerciseVideo } from '@/components/ExerciseVideo'

// "8" -> "8 reps", but "8 reps" or "20yd" stays as-is
function formatReps(reps: string): string {
  const r = String(reps).trim()
  if (/^\d+$/.test(r)) return `${r} reps`
  return r
}

export default async function ProgramDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { edit?: string } }) {
  const editRequested = searchParams.edit === '1'
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
  const isTemplate = !!(program as any).is_template
  const { data: isAdminFlag } = await supabase.rpc('is_admin')
  const isAdmin = isAdminFlag === true
  const ownsProgram = program.coach_id === coach.id
  const editing = editRequested && ownsProgram

  // Most common "written for" max per lift in this program (pre-fills the link form)
  const refCounts: Record<string, Record<number, number>> = {}
  ;(blocks ?? []).forEach((b: any) => (b.workouts ?? []).forEach((w: any) => (w.workout_exercises ?? []).forEach((x: any) => {
    if (x.max_lift && x.ref_max) {
      const m = (refCounts[x.max_lift] ??= {})
      m[Number(x.ref_max)] = (m[Number(x.ref_max)] ?? 0) + 1
    }
  })))
  const refs: Record<string, number> = {}
  Object.entries(refCounts).forEach(([lift, counts]) => {
    refs[lift] = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0])
  })

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
        {ownsProgram && <form action={deleteProgram.bind(null, params.id) as unknown as (formData: FormData) => void}>
          <button type="submit" className="text-zinc-600 hover:text-red-400 transition-colors p-1" title="Delete program">
            <Trash2 className="w-4 h-4" />
          </button>
        </form>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!isTemplate && <ProgramTools programId={params.id} athletes={(athletes ?? []).map(a => ({ id: a.id, name: a.name }))} />}
        {!isTemplate && <SaveAsTemplateButton programId={params.id} title={program.title} isAdmin={isAdmin} />}
        {ownsProgram && (
        <Link
          href={editing ? `/coach/programs/${params.id}` : `/coach/programs/${params.id}?edit=1`}
          className={editing
            ? 'inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:text-white'}
        >
          {editing ? '✓ Done editing' : '✎ Edit program'}
        </Link>
        )}
      </div>
      {editing && (
        <p className="rounded-lg border border-blue-600/30 bg-blue-600/10 px-3 py-2 text-xs text-blue-100">
          Edit mode: add, remove and reorder exercises, add days, copy or delete weeks, and edit warm-ups. Changes save as you go and show up for athletes right away.
        </p>
      )}

      {isTemplate && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-600/40 bg-violet-600/10 px-4 py-3">
          <p className="flex-1 min-w-[12rem] text-sm text-violet-100">
            This is a <b>template</b>{(program as any).is_public_template ? ' shared with every coach' : ''}. Make your own copy to assign it to athletes.
          </p>
          {(ownsProgram || isAdmin) && <TemplateOwnerButtons templateId={params.id} shared={!!(program as any).is_public_template} isAdmin={isAdmin} canDelete={ownsProgram || isAdmin} />}
          <UseTemplateButton templateId={params.id} title={program.title} big />
        </div>
      )}

      {/* Assign Athletes */}
      {!isTemplate && <Card>
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
      </Card>}

      {/* Training Blocks */}
      {blocks && blocks.length > 0 ? (
        <div className="space-y-4">
          {blocks.length > 1 && (
            <p className="text-xs text-zinc-500">Tap a week to open or close it.</p>
          )}
          {blocks.map((block, bIdx) => {
            const workouts = ((block.workouts as any[]) ?? []).sort(
              (a: any, b: any) => (a.day_of_week ?? 0) - (b.day_of_week ?? 0)
            )
            return (
              <details key={block.id} open={bIdx === 0} className="group rounded-2xl border border-zinc-800 bg-zinc-900">
                <summary className="flex cursor-pointer select-none list-none items-center gap-3 px-4 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
                  <Badge variant="blue">Week {block.week_number}</Badge>
                  <span className="flex-1 min-w-0 truncate font-semibold text-white">{block.title}</span>
                  {editing && <WeekControls programId={params.id} blockId={block.id} title={block.title} />}
                  <span className="hidden sm:inline text-xs text-zinc-500">{workouts.length} {workouts.length === 1 ? 'day' : 'days'}</span>
                  <ChevronDown className="w-4 h-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
                  {workouts.length > 0 ? (
                    workouts.map((workout: any, wIdx: number) => {
                      const wxs = (workout.workout_exercises ?? []).sort((a: any, b: any) => a.order - b.order)
                      return (
                        <div key={workout.id} className="border border-zinc-800 rounded-xl overflow-hidden">
                          <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800/30">
                            <span className="text-sm font-semibold text-white">{workout.title}</span>
                            <Badge>Day {wIdx + 1}</Badge>
                            {editing && <DayControls programId={params.id} workoutId={workout.id} title={workout.title} warmup={workout.warmup ?? null} />}
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
                                <div className="flex items-start gap-3 sm:gap-4 px-3 sm:px-4 py-3">
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
                                      <span className="hidden sm:inline"><Badge variant="default">{wx.exercises.category}</Badge></span>
                                    )}
                                    {editing && <ExerciseControls programId={params.id} wxId={wx.id} first={i === 0} last={i === wxs.length - 1} />}
                                    {ownsProgram && <EditExerciseButton programId={params.id} wx={wx} title={wx.exercises?.title ?? 'Exercise'} refs={refs} />}
                                  </div>
                                </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="px-4 py-3 text-xs text-zinc-600">No exercises added</p>
                          )}
                          {editing && (
                            <div className="border-t border-zinc-800">
                              <AddExerciseButton programId={params.id} workoutId={workout.id} section={wxs[wxs.length - 1]?.section ?? null} />
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-sm text-zinc-500">No workouts in this block.</p>
                  )}
                  {editing && <AddDayButton programId={params.id} blockId={block.id} nextNumber={workouts.length + 1} />}
                </div>
              </details>
            )
          })}
          {editing && <AddWeekButton programId={params.id} />}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-zinc-500">
            No training blocks in this program.
            {editing && <div className="mt-4"><AddWeekButton programId={params.id} /></div>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}