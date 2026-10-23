import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { athleteMatch } from '@/lib/acting'
import { getTeamBoard } from '@/lib/leaderboard'
import { LeaderboardView } from '@/components/leaderboard/LeaderboardView'
import { Card, CardContent } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default async function AthleteLeaderboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('athletes').select('id, coach_id').match(await athleteMatch(supabase, user.id)).maybeSingle()
  if (!me) redirect('/login')

  const admin = createAdminClient()
  const board = me.coach_id && admin ? await getTeamBoard(admin, me.coach_id) : null

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-zinc-400 text-sm mt-0.5">See how you stack up with your teammates.</p>
      </div>
      {board ? (
        <LeaderboardView metrics={board.metrics} athletes={board.athletes} meId={me.id} />
      ) : (
        <Card><CardContent className="py-10 text-center text-sm text-zinc-500">Join a coach to see your team&apos;s leaderboard.</CardContent></Card>
      )}
    </div>
  )
}
