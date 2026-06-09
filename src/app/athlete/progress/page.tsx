import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { TEST_META, ALL_TEST_TYPES, formatDate } from '@/lib/utils'
import type { PerformanceTest, CheckIn, TestType } from '@/types'
import { PerformanceChart } from './PerformanceChart'
import { ReadinessChart } from './ReadinessChart'

export default async function ProgressPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: athlete } = await supabase
    .from('athletes')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!athlete) redirect('/login')

  const [{ data: tests }, { data: checkIns }, { data: results }] = await Promise.all([
    supabase
      .from('performance_tests')
      .select('*')
      .eq('athlete_id', athlete.id)
      .order('date'),
    supabase
      .from('check_ins')
      .select('date, readiness_score')
      .eq('athlete_id', athlete.id)
      .order('date')
      .limit(30),
    supabase
      .from('workout_results')
      .select('completed, logged_at')
      .eq('athlete_id', athlete.id)
      .order('logged_at', { ascending: false })
      .limit(30),
  ])

  // Group tests by type
  const testsByType = new Map<TestType, PerformanceTest[]>()
  tests?.forEach(t => {
    if (!testsByType.has(t.test_type as TestType)) testsByType.set(t.test_type as TestType, [])
    testsByType.get(t.test_type as TestType)!.push(t as PerformanceTest)
  })

  const completionRate = results && results.length > 0
    ? Math.round((results.filter(r => r.completed).length / results.length) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Your performance data over time</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Tests Recorded</p>
            <p className="text-3xl font-bold text-white mt-1">{tests?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Completion Rate</p>
            <p className="text-3xl font-bold text-white mt-1">{completionRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Check-Ins</p>
            <p className="text-3xl font-bold text-white mt-1">{checkIns?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Readiness chart */}
      {checkIns && checkIns.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Readiness Trend (Last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ReadinessChart data={checkIns.map(c => ({ date: c.date, score: c.readiness_score }))} />
          </CardContent>
        </Card>
      )}

      {/* Performance test charts */}
      {ALL_TEST_TYPES.map(testType => {
        const typeTests = testsByType.get(testType)
        if (!typeTests || typeTests.length === 0) return null
        const meta = TEST_META[testType]
        const latest = typeTests[typeTests.length - 1]
        const first = typeTests[0]
        const improved = meta.higherIsBetter
          ? latest.result > first.result
          : latest.result < first.result

        return (
          <Card key={testType}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{meta.label}</CardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">{typeTests.length} tests recorded</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-400">{latest.result}</p>
                <p className="text-xs text-zinc-500">{meta.unit}</p>
                {typeTests.length > 1 && (
                  <Badge variant={improved ? 'green' : 'red'} className="mt-1">
                    {improved ? '▲' : '▼'} {Math.abs(latest.result - first.result).toFixed(2)} {meta.unit}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {typeTests.length > 1 ? (
                <PerformanceChart
                  data={typeTests.map(t => ({ date: t.date, value: t.result }))}
                  unit={meta.unit}
                  higherIsBetter={meta.higherIsBetter}
                />
              ) : (
                <div className="text-center py-6 text-sm text-zinc-500">
                  Recorded on {formatDate(latest.date)} — add more tests to see trends
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      {(!tests || tests.length === 0) && (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-zinc-400">No performance tests recorded yet.</p>
            <p className="text-sm text-zinc-500 mt-1">Your coach will add test results here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
