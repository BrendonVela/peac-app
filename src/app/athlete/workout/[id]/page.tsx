import { createClient } from '@/lib/supabase/server'
import { athleteMatch } from '@/lib/acting'
import { redirect } from 'next/navigation'
import { WorkoutView } from './WorkoutView'

export default async function WorkoutPage({ params, searchParams }: { params: { id: string }; searchParams: { weights?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: athlete } = await supabase
    .from('athletes')
    .select('id')
    .match(await athleteMatch(supabase, user.id))
    .single()

  if (!athlete) redirect('/login')

  return <WorkoutView athleteId={athlete.id} workoutId={params.id} weights={searchParams.weights === 'full' ? 'full' : 'auto'} />
}
