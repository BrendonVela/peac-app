'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ExerciseCategory } from '@/types'

export async function createExercise(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('exercises').insert({
    title: formData.get('title') as string,
    category: formData.get('category') as ExerciseCategory,
    description: (formData.get('description') as string) || null,
    coaching_cues: (formData.get('coaching_cues') as string) || null,
    video_url: (formData.get('video_url') as string) || null,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/coach/exercises')
}

export async function updateExercise(id: string, formData: FormData) {
  const supabase = createClient()

  const { error } = await supabase.from('exercises').update({
    title: formData.get('title') as string,
    category: formData.get('category') as ExerciseCategory,
    description: (formData.get('description') as string) || null,
    coaching_cues: (formData.get('coaching_cues') as string) || null,
    video_url: (formData.get('video_url') as string) || null,
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/coach/exercises')
}

export async function deleteExercise(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('exercises').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/coach/exercises')
}
