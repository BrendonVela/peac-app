import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WorkoutLogger } from './WorkoutLogger'

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
    .select('id, title, notes, workout_exercises(id, sets, reps, load, tempo, rest, notes, order, exercises(id, title, category, coaching_cues, video_url))')
    .eq('id', params.id)
    .single()

  if (!workout) notFound()

  const exercises = ((workout.workout_exercises ?? []) as any[])
    .sort((a, b) => a.order - b.order)

  // Fetch existing results
  const { data: results } = await supabase
    .from('workout_results')
    .select('*')
    .eq('athlete_id', athlete.id)
    .eq('workout_id', params.id)

  const resultMap = new Map(results?.map(r => [r.workout_exercise_id, r]) ?? [])

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

      {exercises.length > 0 ? (
        <div className="space-y-4">
          {exercises.map((wx: any, i: number) => {
            const ex = wx.exercises
            const existing = resultMap.get(wx.id)
            return (
              <Card key={wx.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-zinc-600 font-mono">{i + 1}.</span>
                        <CardTitle>{ex?.title}</CardTitle>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {wx.sets && <span className="text-xs text-zinc-400">{wx.sets} sets</span>}
                        {wx.reps && <span className="text-xs text-zinc-400">{wx.reps} reps</span>}
                        {wx.load && <span className="text-xs text-zinc-400">{wx.load}</span>}
                        {wx.tempo && <span className="text-xs text-zinc-500">Tempo: {wx.tempo}</span>}
                        {wx.rest && <span className="text-xs text-zinc-500">Rest: {wx.rest}</span>}
                      </div>
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
                    initialWeight={existing?.weight_used ?? undefined}
                    initialReps={existing?.reps_completed ?? undefined}
                    initialCompleted={existing?.completed ?? false}
                    initialNotes={existing?.notes ?? ''}
                    videoUrl={ex?.video_url}
                  />
                </CardContent>
              </Card>
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
