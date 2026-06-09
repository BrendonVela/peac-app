'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { TEST_META } from '@/lib/utils'
import type { TestType } from '@/types'

export async function addPerformanceTest(athleteId: string, formData: FormData) {
  const supabase = createClient()

  const test_type = formData.get('test_type') as TestType
  const result = parseFloat(formData.get('result') as string)
  const date = formData.get('date') as string

  const { error } = await supabase.from('performance_tests').insert({
    athlete_id: athleteId,
    test_type,
    result,
    unit: TEST_META[test_type]?.unit ?? '',
    date,
    notes: (formData.get('notes') as string) || null,
  })

  if (error) return { error: error.message }
  revalidatePath(`/coach/athletes/${athleteId}`)
  revalidatePath('/athlete/progress')
}
