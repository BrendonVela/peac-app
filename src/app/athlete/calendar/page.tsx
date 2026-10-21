import { createClient } from '@/lib/supabase/server'
import { athleteMatch } from '@/lib/acting'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/Card'
import { ScheduleCalendar } from '@/components/ScheduleCalendar'
import { getAthleteSchedule } from '@/lib/schedule'

export default async function AthleteCalendarPage({
  searchParams,
}: {
  searchParams: { month?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: athlete } = await supabase
    .from('athletes')
    .select('id')
    .match(await athleteMatch(supabase, user.id))
    .single()
  if (!athlete) redirect('/login')

  const schedule = await getAthleteSchedule(supabase, athlete.id)
  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? '') ? searchParams.month! : schedule.today.slice(0, 7)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Tap a workout to open it or move it to another day.</p>
      </div>
      <Card>
        <CardContent className="py-5">
          <ScheduleCalendar
            items={schedule.items}
            athleteId={athlete.id}
            today={schedule.today}
            month={month}
            basePath="/athlete/calendar"
            mode="athlete"
          />
        </CardContent>
      </Card>
    </div>
  )
}
