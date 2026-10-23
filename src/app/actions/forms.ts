'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getActingCoachId } from './viewAs'
import { currentPeriod, type Question, type FormRow } from '@/lib/forms'

function clean(questions: Question[]): Question[] {
  return questions
    .map(q => ({
      id: q.id || Math.random().toString(36).slice(2, 10),
      label: String(q.label ?? '').trim(),
      type: q.type,
      required: !!q.required,
      ...(q.type === 'choice' ? { options: (q.options ?? []).map(o => o.trim()).filter(Boolean) } : {}),
    }))
    .filter(q => q.label)
}

export async function saveForm(form: {
  id?: string
  title: string
  description: string
  frequency: FormRow['frequency']
  questions: Question[]
  group_id: string | null
  active: boolean
}) {
  const supabase = createClient()
  const coachId = await getActingCoachId()
  if (!coachId) return { error: 'Coach not found' }
  if (!form.title.trim()) return { error: 'Give the form a title.' }
  const questions = clean(form.questions)
  if (questions.length === 0) return { error: 'Add at least one question.' }
  if (questions.some(q => q.type === 'choice' && (q.options?.length ?? 0) < 2)) return { error: 'Multiple-choice questions need at least 2 options.' }

  const row = {
    coach_id: coachId,
    title: form.title.trim(),
    description: form.description.trim() || null,
    frequency: form.frequency,
    questions,
    group_id: form.group_id || null,
    active: form.active,
  }
  const res = form.id
    ? await supabase.from('forms').update(row).eq('id', form.id).select('id').single()
    : await supabase.from('forms').insert(row).select('id').single()
  if (res.error) return { error: res.error.message }
  revalidatePath('/coach/forms')
  revalidatePath('/athlete/forms')
  return { id: res.data.id as string }
}

export async function deleteForm(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('forms').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/coach/forms')
  return { ok: true }
}

export async function setFormActive(id: string, active: boolean) {
  const supabase = createClient()
  const { error } = await supabase.from('forms').update({ active }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/coach/forms')
  return { ok: true }
}

/** Athlete submits (or updates) their answers for this period */
export async function submitFormResponse(formId: string, answers: Record<string, unknown>) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const [{ data: athlete }, { data: forms }] = await Promise.all([
    supabase.from('athletes').select('id').eq('user_id', user.id).maybeSingle(),
    supabase.rpc('my_forms'),
  ])
  const form = ((forms ?? []) as FormRow[]).find(f => f.id === formId)
  if (!athlete || !form) return { error: 'This form is no longer available.' }

  for (const q of form.questions) {
    const v = answers[q.id]
    if (q.required && (v === undefined || v === null || v === '')) return { error: `Please answer: ${q.label}` }
  }
  const { error } = await supabase.from('form_responses').upsert(
    { form_id: formId, athlete_id: athlete.id, period: currentPeriod(form.frequency), answers, submitted_at: new Date().toISOString() },
    { onConflict: 'form_id,athlete_id,period' }
  )
  if (error) return { error: error.message }
  revalidatePath('/athlete/forms')
  revalidatePath('/athlete/dashboard')
  revalidatePath(`/coach/forms/${formId}`)
  return { ok: true }
}
