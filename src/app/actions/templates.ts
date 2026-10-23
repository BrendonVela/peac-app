'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getActingCoachId } from './viewAs'
import { copyProgram } from '@/lib/copyProgram'

/** Save a copy of a program as a reusable template */
export async function saveAsTemplate(programId: string, title: string, description: string, share: boolean) {
  const supabase = createClient()
  const coachId = await getActingCoachId()
  if (!coachId) return { error: 'Coach not found' }
  if (!title.trim()) return { error: 'Give the template a name.' }
  if (share) {
    const { data: isAdmin } = await supabase.rpc('is_admin')
    if (isAdmin !== true) return { error: 'Only the admin can share templates with every coach.' }
  }
  const res = await copyProgram(supabase, programId, {
    coach_id: coachId,
    title: title.trim(),
    description: description.trim() || null,
    is_template: true,
    is_public_template: share,
  })
  if (res.error) return { error: res.error }
  revalidatePath('/coach/programs')
  return { id: res.id }
}

/** Start a new program from a template */
export async function startFromTemplate(templateId: string, title: string) {
  const supabase = createClient()
  const coachId = await getActingCoachId()
  if (!coachId) return { error: 'Coach not found' }
  const { data: t } = await supabase.from('programs').select('title, description').eq('id', templateId).maybeSingle()
  if (!t) return { error: 'Template not found' }
  const res = await copyProgram(supabase, templateId, {
    coach_id: coachId,
    title: title.trim() || t.title,
    description: t.description,
    is_template: false,
  })
  if (res.error) return { error: res.error }
  revalidatePath('/coach/programs')
  return { id: res.id }
}

/** Admin: share or unshare a template with every coach */
export async function setTemplateShared(templateId: string, share: boolean) {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'Only the admin can do this.' }
  const { error } = await supabase.from('programs').update({ is_public_template: share }).eq('id', templateId).eq('is_template', true)
  if (error) return { error: error.message }
  revalidatePath('/coach/programs')
  revalidatePath(`/coach/programs/${templateId}`)
  return { ok: true }
}

export async function deleteTemplate(templateId: string) {
  const supabase = createClient()
  const { error } = await supabase.from('programs').delete().eq('id', templateId).eq('is_template', true)
  if (error) return { error: error.message }
  revalidatePath('/coach/programs')
  return { ok: true }
}
