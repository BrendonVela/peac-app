import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = user.user_metadata?.role as string | undefined
  if (role === 'coach') redirect('/coach/dashboard')
  if (role === 'athlete') redirect('/athlete/dashboard')

  redirect('/login')
}
