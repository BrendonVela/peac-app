import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getReadinessBadge, getReadinessLabel, formatDate, TEST_META } from '@/lib/utils'
import { AddPerformanceTestForm } from './AddPerformanceTestForm'

export default async function AthleteDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: athlete } = await supabase
    .from('athletes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!athlete) notFound()

  const [{ data: checkIns }, { data: tests }, { data: assignments }] = await Promise.all([
    supabase
      .from('check_ins')
      .select('*')
      .eq('athlete_id', params.id)
      .order('date', { ascending: false })
      .limit(7),
    supabase
      .from('performance_tests')
      .select('*')
      .eq('athlete_id', params.id)
      .order('date', { ascending: false }),
    supabase
      .from('program_assignments')
      .select('id, programs(id, title)')
      .eq('athlete_id', params.id),
  ])

  const latestCheckIn = checkIns?.[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/coach/athletes" className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{athlete.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {athlete.sport && <Badge variant="blue">{athlete.sport}</Badge>}
            {athlete.position && <Badge>{athlete.position}</Badge>}
            {athlete.graduation_year && (
              <span className="text-sm text-zinc-500">Class of {athlete.graduation_year}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Readiness */}
        <Card>
          <CardContent className="py-5">
            <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-2">Today&apos;s Readiness</p>
            {latestCheckIn && latestCheckIn.date === new Date().toISOString().split('T')[0] ? (
              <div>
                <div className={`inline-flex px-2.5 py-1 rounded-full text-sm font-semibold mb-3 ${getReadinessBadge(latestCheckIn.readiness_score)}`}>
                  {getReadinessLabel(latestCheckIn.readiness_score)} — {latestCheckIn.readiness_score.toFixed(1)}/10
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ['Sleep', latestCheckIn.sleep_quality],
                    ['Energy', latestCheckIn.energy],
                    ['Stress', latestCheckIn.stress],
                    ['Soreness', latestCheckIn.soreness],
                    ['Motivation', latestCheckIn.motivation],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between text-zinc-400">
                      <span>{label}</span>
                      <span className="text-white font-medium">{val}/10</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No check-in today</p>
            )}
          </CardContent>
        </Card>

        {/* Assigned Programs */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Assigned Programs</CardTitle>
          </CardHeader>
          <CardContent className="py-3">
            {assignments && assignments.length > 0 ? (
              <div className="space-y-2">
                {assignments.map(a => {
                  const program = a.programs as { id: string; title: string } | null
                  return program ? (
                    <Link
                      key={a.id}
                      href={`/coach/programs/${program.id}`}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                    >
                      <span className="text-sm text-white">{program.title}</span>
                    </Link>
                  ) : null
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No programs assigned.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Tests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Performance Tests</CardTitle>
          <AddPerformanceTestForm athleteId={params.id} />
        </CardHeader>
        <CardContent className="px-0 py-0">
          {tests && tests.length > 0 ? (
            <div className="divide-y divide-zinc-800">
              {tests.map(test => (
                <div key={test.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-white">{TEST_META[test.test_type as keyof typeof TEST_META]?.label}</p>
                    <p className="text-xs text-zinc-500">{formatDate(test.date)}</p>
                  </div>
                  <span className="text-lg font-bold text-blue-400">
                    {test.result} <span className="text-sm font-normal text-zinc-500">{test.unit}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-zinc-500">
              No performance tests recorded yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-in History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Check-Ins</CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {checkIns && checkIns.length > 0 ? (
            <div className="divide-y divide-zinc-800">
              {checkIns.map(ci => (
                <div key={ci.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm text-zinc-400">{formatDate(ci.date)}</p>
                    <div className="flex gap-3 mt-1 text-xs text-zinc-500">
                      <span>Sleep {ci.sleep_quality}</span>
                      <span>Energy {ci.energy}</span>
                      <span>Stress {ci.stress}</span>
                      <span>Soreness {ci.soreness}</span>
                    </div>
                  </div>
                  <div className={`text-xs font-semibold px-2 py-1 rounded-full ${getReadinessBadge(ci.readiness_score)}`}>
                    {ci.readiness_score.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-zinc-500">No check-ins yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
