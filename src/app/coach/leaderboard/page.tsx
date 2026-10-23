import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { coachMatch } from '@/lib/acting'
import { getTeamBoard } from '@/lib/leaderboard'
import { LeaderboardView } from '@/components/leaderboard/LeaderboardView'

export const dynamic = 'force-dynamic'

export default async function CoachLeaderboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: coach } = await supabase.from('coaches').select('id').match(await coachMatch(supabase, user.id)).maybeSingle()
  if (!coach) redirect('/login')

  const admin = createAdminClient()
  const board = admin ? await getTeamBoard(admin, coach.id) : { athletes: [], metrics: [] }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Your athletes ranked on main lifts and tests. Athletes see the same board.</p>
      </div>
      <LeaderboardView metrics={board.metrics} athletes={board.athletes} showGroups />
    </div>
  )
}
