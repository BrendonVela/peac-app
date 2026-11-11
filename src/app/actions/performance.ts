'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { TEST_META } from '@/lib/utils'

/** Add a test result. test_type is a built-in key, "custom:<id>", or "new" (then a new team test is created first) */
export async function addPerformanceTest(athleteId: string, formData: FormData) {
  const supabase = createClient()

  let test_type = String(formData.get('test_type') ?? '')
  const result = parseFloat(formData.get('result') as string)
  const date = formData.get('date') as string
  if (!isFinite(result)) return { error: 'Enter a number for the result.' }
  let unit = ''

  if (test_type === 'new') {
    const label = String(formData.get('new_label') ?? '').trim()
    unit = String(formData.get('new_unit') ?? '').trim()
    const higher = String(formData.get('new_better') ?? 'higher') === 'higher'
    if (!label) return { error: 'Type a name for the new test.' }

    // The athlete's team (head coach) owns the test list
    const { data: ath } = await supabase.from('athletes').select('coach_id').eq('id', athleteId).maybeSingle()
    const coachId = ath?.coach_id
    if (!coachId) return { error: 'This athlete has no coach yet.' }

    // Reuse a test with the same name if it already exists
    const { data: existing, error: findErr } = await supabase
      .from('custom_tests').select('id, unit').eq('coach_id', coachId).ilike('label', label).limit(1).maybeSingle()
    if (findErr && /custom_tests/.test(findErr.message)) return { error: 'Run the custom_tests SQL in Supabase first (see setup steps).' }
    let id = existing?.id as string | undefined
    if (existing) unit = existing.unit || unit
    if (!id) {
      const { data: created, error: cErr } = await supabase
        .from('custom_tests').insert({ coach_id: coachId, label, unit, higher_is_better: higher }).select('id').single()
      if (cErr || !created) return { error: cErr?.message ?? 'Could not create the test.' }
      id = created.id
    }
    test_type = `custom:${id}`
  } else if (test_type.startsWith('custom:')) {
    const { data: ct } = await supabase.from('custom_tests').select('unit').eq('id', test_type.slice(7)).maybeSingle()
    unit = ct?.unit ?? ''
  } else {
    unit = TEST_META[test_type as keyof typeof TEST_META]?.unit ?? ''
  }

  const { error } = await supabase.from('performance_tests').insert({
    athlete_id: athleteId,
    test_type,
    result,
    unit,
    date,
    notes: (formData.get('notes') as string) || null,
  })

  if (error) {
    if (/check constraint|test_type_check/i.test(error.message)) return { error: 'Run the custom_tests SQL in Supabase first (see setup steps).' }
    return { error: error.message }
  }
  revalidatePath(`/coach/athletes/${athleteId}`)
  revalidatePath('/athlete/progress')
  revalidatePath('/coach/leaderboard')
  revalidatePath('/athlete/leaderboard')
}
