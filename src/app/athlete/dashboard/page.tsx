import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Dumbbell, ChevronRight, Heart, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { getReadinessBadge, getReadinessLabel, DAYS_OF_WEEK } from '@/lib/utils'

export default async function AthleteDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, name, coach_id, coaches(name)')
    .eq('user_id', user.id)
    .single()

  if (!athlete) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const todayDow = new Date().getDay()

  const [{ data: checkIn }, { data: assignments }, { data: recentTests }] = await Promise.all([
    supabase
      .from('check_ins')
      .select('*')
      .eq('athlete_id', athlete.id)
      .eq('date', today)
      .single(),
    supabase
      .from('program_assignments')
      .select('program_id, programs(id, title, training_blocks(id, title, week_number, workouts(id, title, day_of_week, workout_exercises(id))))')
      .eq('athlete_id', athlete.id),
    supabase
      .from('performance_tests')
      .select('test_type, result, unit, date')
      .eq('athlete_id', athlete.id)
      .order('date', { ascending: false })
      .limit(3),
  ])

  // Find today's workouts
  const todayWorkouts: Array<{ id: string; title: string; programTitle: string; exerciseCount: number }> = []
  const upcomingWorkouts: typeof todayWorkouts = []

  assignments?.forEach(a => {
    const program = a.programs as any
    if (!program) return
    program.training_blocks?.forEach((block: any) => {
      block.workouts?.forEach((workout: any) => {
        const entry = {
          id: workout.id,
          title: workout.title,
          programTitle: program.title,
          exerciseCount: workout.workout_exercises?.length ?? 0,
        }
        if (workout.day_of_week === todayDow) {
          todayWorkouts.push(entry)
        } else {
          upcomingWorkouts.push(entry)
        }
      })
    })
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hey, {athlete.name.split(' ')[0]} 👊</h1>
        {(athlete as any).coaches && (
          <p className="text-zinc-400 text-sm mt-0.5">
            Coach: {((athlete as any).coaches as any).name}
          </p>
        )}
      </div>

      {/* Readiness */}
      <Card className={!checkIn ? 'border-yellow-500/30' : ''}>
        <CardContent className="py-5">
          {checkIn ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">Today&apos;s Readiness</p>
                <div className={`inline-flex px-3 py-1.5 rounded-full text-sm font-bold ${getReadinessBadge(checkIn.readiness_score)}`}>
                  {getReadinessLabel(checkIn.readiness_score)} — {checkIn.readiness_score.toFixed(1)}/10
                </div>
              </div>
              <Link href="/athlete/checkin">
                <Button variant="ghost" size="sm">Update</Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">Daily Check-In</p>
                <p className="text-sm text-zinc-300">How are you feeling today?</p>
              </div>
              <Link href="/athlete/checkin">
                <Button size="sm">
                  <Heart className="w-4 h-4" />
                  Check In
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Workouts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Today&apos;s Workouts</CardTitle>
          <Badge variant="blue">{DAYS_OF_WEEK[todayDow]}</Badge>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {todayWorkouts.length > 0 ? (
            <div className="divide-y divide-zinc-800">
              {todayWorkouts.map(workout => (
                <Link
                  key={workout.id}
                  href={`/athlete/workout/${workout.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600/10 rounded-lg">
                      <Dumbbell className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{workout.title}</p>
                      <p className="text-xs text-zinc-500">{workout.programTitle} · {workout.exerciseCount} exercises</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-zinc-500">
              No workouts scheduled for today. Rest up! 💤
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming */}
      {upcomingWorkouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Workouts</CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-0">
            <div className="divide-y divide-zinc-800">
              {upcomingWorkouts.slice(0, 4).map(workout => (
                <Link
                  key={workout.id}
                  href={`/athlete/workout/${workout.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-800/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{workout.title}</p>
                    <p className="text-xs text-zinc-500">{workout.programTitle} · {workout.exerciseCount} exercises</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Tests */}
      {recentTests && recentTests.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Performance</CardTitle>
            <Link href="/athlete/progress" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="px-0 py-0 divide-y divide-zinc-800">
            {recentTests.map((test: any, i: any) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5">
                <p className="text-sm text-zinc-300">{test.test_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                <span className="text-base font-bold text-blue-400">{test.result} <span className="text-xs font-normal text-zinc-500">{test.unit}</span></span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

