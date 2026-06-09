'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitCheckIn(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: athlete } = await supabase
    .from('athletes')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!athlete) return { error: 'Athlete profile not found' }

  const today = new Date().toISOString().split('T')[0]
  const sleep_quality = parseInt(formData.get('sleep_quality') as string)
  const energy = parseInt(formData.get('energy') as string)
  const stress = parseInt(formData.get('stress') as string)
  const soreness = parseInt(formData.get('soreness') as string)
  const motivation = parseInt(formData.get('motivation') as string)

  const { error } = await supabase.from('check_ins').upsert({
    athlete_id: athlete.id,
    sleep_quality,
    energy,
    stress,
    soreness,
    motivation,
    notes: (formData.get('notes') as string) || null,
    date: today,
  }, { onConflict: 'athlete_id,date' })

  if (error) return { error: error.message }
  revalidatePath('/athlete/dashboard')
  revalidatePath('/athlete/checkin')
}
