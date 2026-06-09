import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { DAYS_OF_WEEK, formatDate } from '@/lib/utils'
import { deleteProgram } from '@/app/actions/programs'
import { AssignProgramForm } from './AssignProgramForm'

export default async function ProgramDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: coach } = await supabase.from('coaches').select('id').eq('user_id', user.id).single()
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
      .select('id, title, week_number, order, workouts(id, title, day_of_week, notes, workout_exercises(id, sets, reps, load, tempo, rest, notes, order, exercises(title, category)))')
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
        <form action={deleteProgram.bind(null, params.id)}>
          <button type="submit" className="text-zinc-600 hover:text-red-400 transition-colors p-1" title="Delete program">
            <Trash2 className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Assign Athletes */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Athletes</CardTitle>
        </CardHeader>
        <CardContent>
          <AssignProgramForm
            programId={params.id}
            athletes={athletes ?? []}
            assignedIds={[...assignedIds]}
          />
        </CardContent>
      </Card>

      {/* Training Blocks */}
      {blocks && blocks.length > 0 ? (
        <div className="space-y-4">
          {blocks.map(block => {
            const workouts = (block.workouts as any[]) ?? []
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
                    workouts.map((workout: any) => {
                      const wxs = (workout.workout_exercises ?? []).sort((a: any, b: any) => a.order - b.order)
                      return (
                        <div key={workout.id} className="border border-zinc-800 rounded-xl overflow-hidden">
                          <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800/30">
                            <span className="text-sm font-semibold text-white">{workout.title}</span>
                            <Badge>{DAYS_OF_WEEK[workout.day_of_week]}</Badge>
                          </div>

                          {wxs.length > 0 ? (
                            <div className="divide-y divide-zinc-800">
                              {wxs.map((wx: any, i: number) => (
                                <div key={wx.id} className="flex items-start gap-4 px-4 py-3">
                                  <span className="text-xs text-zinc-600 font-mono w-5 shrink-0 mt-0.5">{i + 1}.</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white">{wx.exercises?.title}</p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                      {wx.sets && <span className="text-xs text-zinc-400">{wx.sets} sets</span>}
                                      {wx.reps && <span className="text-xs text-zinc-400">{wx.reps} reps</span>}
                                      {wx.load && <span className="text-xs text-zinc-400">{wx.load}</span>}
                                      {wx.tempo && <span className="text-xs text-zinc-500">Tempo: {wx.tempo}</span>}
                                      {wx.rest && <span className="text-xs text-zinc-500">Rest: {wx.rest}</span>}
                                    </div>
                                    {wx.notes && <p className="text-xs text-zinc-500 mt-1 italic">{wx.notes}</p>}
                                  </div>
                                  {wx.exercises?.category && (
                                    <Badge variant="default" className="shrink-0">{wx.exercises.category}</Badge>
                                  )}
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
