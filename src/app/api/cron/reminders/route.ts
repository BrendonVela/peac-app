import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTeamSchedules } from '@/lib/schedule'
import { sendPushToUsers, pushIsConfigured } from '@/lib/push'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Daily workout reminders. Vercel runs this every morning (see vercel.json).
 * Sends "You have a workout today" to athletes who turned notifications on.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!pushIsConfigured()) return NextResponse.json({ error: 'Push not configured' }, { status: 500 })

  const admin = createAdminClient()!
  const { data: subs } = await admin.from('push_subscriptions').select('user_id')
  const userIds = Array.from(new Set((subs ?? []).map((s: { user_id: string }) => s.user_id)))
  if (userIds.length === 0) return NextResponse.json({ athletes: 0, sent: 0 })

  const { data: athletes } = await admin.from('athletes').select('id, user_id, name').in('user_id', userIds)

  let sent = 0
  const team = await getTeamSchedules(admin, (athletes ?? []).map((a: { id: string }) => a.id))
  for (const athlete of athletes ?? []) {
    try {
      const schedule = team.get(athlete.id)
      if (!schedule) continue
      const todays = schedule.items.filter(i => i.plannedDate === schedule.today && i.status !== 'done')
      if (todays.length === 0) continue
      const first = todays[0]
      const firstName = String(athlete.name ?? '').split(' ')[0]
      sent += await sendPushToUsers([athlete.user_id], {
        title: todays.length > 1 ? `${todays.length} workouts today` : 'Workout today 💪',
        body: `${firstName ? firstName + ', ' : ''}${first.title} — Week ${first.weekNumber}, Day ${first.dayNumber}. Tap to start.`,
        url: todays.length > 1 ? '/athlete/dashboard' : `/athlete/workout/${first.workoutId}`,
        tag: `reminder-${schedule.today}`,
      })
    } catch (e) {
      console.error('reminder failed for athlete', athlete.id, e)
    }
  }

  return NextResponse.json({ athletes: athletes?.length ?? 0, sent })
}
