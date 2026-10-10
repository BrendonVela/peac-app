'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { LIFTS } from '@/lib/maxes'

/** Save an athlete's 1-rep maxes. Empty values remove that max. */
export async function saveAthleteMaxes(athleteId: string, values: Record<string, string>) {
  const supabase = createClient()

  for (const { key } of LIFTS) {
    const raw = (values[key] ?? '').trim()
    if (raw === '') {
      const { error } = await supabase.from('athlete_maxes').delete().eq('athlete_id', athleteId).eq('lift', key)
      if (error) return { error: error.message }
      continue
    }
    const value = Number(raw)
    if (!isFinite(value) || value <= 0) return { error: `Invalid number for ${key}` }
    const { error } = await supabase
      .from('athlete_maxes')
      .upsert(
        { athlete_id: athleteId, lift: key, value, updated_at: new Date().toISOString() },
        { onConflict: 'athlete_id,lift' }
      )
    if (error) return { error: error.message }
  }

  revalidatePath(`/coach/athletes/${athleteId}`)
  revalidatePath('/athlete/dashboard')
  return { ok: true }
}
