'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getActingCoachId } from './viewAs'
import { currentPeriod, hasOptions, type Question, type FormRow } from '@/lib/forms'

function clean(questions: Question[]): Question[] {
  return questions
    .map(q => ({
      id: q.id || Math.random().toString(36).slice(2, 10),
      label: String(q.label ?? '').trim(),
      type: q.type,
      required: !!q.required,
      ...(hasOptions(q.type) ? { options: (q.options ?? []).map(o => o.trim()).filter(Boolean) } : {}),
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
  isPublic?: boolean
  showAthletes?: boolean
}) {
  const supabase = createClient()
  const coachId = await getActingCoachId()
  if (!coachId) return { error: 'Coach not found' }
  if (!form.title.trim()) return { error: 'Give the form a title.' }
  const questions = clean(form.questions)
  if (questions.length === 0) return { error: 'Add at least one question.' }
  const few = questions.find(q => hasOptions(q.type) && (q.options?.length ?? 0) < 2)
  if (few) return { error: `"${few.label}" needs at least 2 options.` }

  const row = {
    coach_id: coachId,
    title: form.title.trim(),
    description: form.description.trim() || null,
    frequency: form.frequency,
    questions,
    group_id: form.group_id || null,
    active: form.active,
    show_athletes: form.showAthletes ?? true,
    public_slug: null as string | null,
  }
  // Public link: keep the same link once made, so shared links keep working
  if (form.isPublic) {
    const existing = form.id ? (await supabase.from('forms').select('public_slug').eq('id', form.id).maybeSingle()).data?.public_slug : null
    const base = row.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'form'
    row.public_slug = existing || `${base}-${Math.random().toString(36).slice(2, 8)}`
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
    if (q.required && (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0))) return { error: `Please answer: ${q.label}` }
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
