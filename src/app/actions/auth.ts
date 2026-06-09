'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function login(formData: FormData) {
  const supabase = createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  const role = data.user?.user_metadata?.role
  if (role === 'coach') redirect('/coach/dashboard')
  if (role === 'athlete') redirect('/athlete/dashboard')
  redirect('/')
}

export async function register(formData: FormData) {
  const supabase = createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string
  const role = formData.get('role') as 'coach' | 'athlete'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role } },
  })
  if (error) return { error: error.message }
  if (!data.user) return { error: 'Registration failed' }

  if (role === 'coach') {
    const { error: coachError } = await supabase
      .from('coaches')
      .insert({ user_id: data.user.id, name })
    if (coachError) return { error: coachError.message }
    redirect('/coach/dashboard')
  } else {
    const { error: athleteError } = await supabase
      .from('athletes')
      .insert({ user_id: data.user.id, name })
    if (athleteError) return { error: athleteError.message }
    redirect('/athlete/dashboard')
  }
}
