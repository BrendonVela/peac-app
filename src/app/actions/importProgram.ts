'use server'

import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { parseExcelProgram } from '@/lib/parseExcelProgram'
import { importWeeks, prepareImport, saveWeeks } from '@/lib/importWeeks'
import type { ParsedWeek } from '@/lib/parseExcelProgram'
import { revalidatePath } from 'next/cache'

/** Import an Excel program. Never crashes the page — returns { id } or a readable { error }. */
export async function importProgramFromExcel(formData: FormData): Promise<{ id?: string; error?: string }> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Please sign in again.' }

    const { data: coach } = await supabase
      .from('coaches')
      .select('id')
      .match(await coachMatch(supabase, user.id))
      .single()
    if (!coach) return { error: 'Coach profile not found.' }

    const file = formData.get('file') as File | null
    if (!file || !file.size) return { error: 'Choose an Excel file first.' }
    if (!/\.xlsx?$/i.test(file.name)) return { error: 'That isn’t an Excel file (.xlsx). For a PDF or photo, use “Import from a PDF or photo”.' }

    let weeks
    try {
      weeks = parseExcelProgram(await file.arrayBuffer())
    } catch (e) {
      console.error('[import] parse failed', file.name, e)
      return { error: `Couldn’t read this file: ${(e as Error).message}` }
    }
    if (!weeks.length) {
      return { error: 'No workouts found in this file. Each day needs a heading like “DAY 1”, “Day A” or “Monday”, with exercises under it.' }
    }

    const rawName = file.name.replace(/\.xlsx?$/i, '').replace(/^Copy[_ ]of[_ ]/i, '').replace(/_/g, ' ')
    const id = await importWeeks(supabase, coach.id, weeks, rawName, 'Imported from Excel')
    return { id }
  } catch (e) {
    console.error('[import] failed', e)
    return { error: `Import failed: ${(e as Error).message || 'unknown error'}. Send this message to support.` }
  }
}

// ---------- Step-by-step import (lets the page show a real progress bar) ----------

async function myCoachId() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, coachId: null }
  const { data: coach } = await supabase.from('coaches').select('id').match(await coachMatch(supabase, user.id)).maybeSingle()
  return { supabase, coachId: (coach?.id as string) ?? null }
}

/** Step 1: read the file, set up exercises and the program. */
export async function excelImportStart(formData: FormData): Promise<
  { programId: string; nameToId: Record<string, string>; weeks: ParsedWeek[] } | { error: string }
> {
  try {
    const { supabase, coachId } = await myCoachId()
    if (!coachId) return { error: 'Please sign in again.' }
    const file = formData.get('file') as File | null
    if (!file || !file.size) return { error: 'Choose an Excel file first.' }
    if (!/\.xlsx?$/i.test(file.name)) return { error: 'That isn’t an Excel file (.xlsx). For a PDF or photo, use “Import from a PDF or photo”.' }
    let weeks: ParsedWeek[]
    try {
      weeks = parseExcelProgram(await file.arrayBuffer())
    } catch (e) {
      return { error: `Couldn’t read this file: ${(e as Error).message}` }
    }
    weeks = weeks.filter(w => w.days.length > 0)
    if (!weeks.length) return { error: 'No workouts found in this file. Each day needs a heading like “DAY 1”, “Day A” or “Monday”, with exercises under it.' }
    const rawName = file.name.replace(/\.xlsx?$/i, '').replace(/^Copy[_ ]of[_ ]/i, '').replace(/_/g, ' ')
    const { programId, nameToId } = await prepareImport(supabase, coachId, weeks, rawName, 'Imported from Excel')
    return { programId, nameToId, weeks }
  } catch (e) {
    return { error: `Import failed: ${(e as Error).message || 'unknown error'}` }
  }
}

/** Step 2 (repeated): save a few weeks. */
export async function excelImportWeeks(programId: string, weeks: ParsedWeek[], nameToId: Record<string, string>) {
  const { supabase, coachId } = await myCoachId()
  if (!coachId) return { error: 'Please sign in again.' }
  const { data: program } = await supabase.from('programs').select('id').eq('id', programId).eq('coach_id', coachId).maybeSingle()
  if (!program) return { error: 'Program not found.' }
  try {
    return await saveWeeks(supabase, programId, weeks, nameToId)
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Step 3: check something was saved (or clean up), then refresh the lists. */
export async function excelImportFinish(programId: string, workouts: number, firstError: string | null) {
  const { supabase, coachId } = await myCoachId()
  if (!coachId) return { error: 'Please sign in again.' }
  if (workouts === 0) {
    await supabase.from('programs').delete().eq('id', programId).eq('coach_id', coachId)
    return { error: firstError ? `No workouts could be saved (${firstError}).` : 'No workouts were found in that file.' }
  }
  revalidatePath('/coach/programs')
  revalidatePath('/coach/exercises')
  return { ok: true }
}
