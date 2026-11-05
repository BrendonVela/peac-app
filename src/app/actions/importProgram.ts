'use server'

import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { parseExcelProgram } from '@/lib/parseExcelProgram'
import { importWeeks } from '@/lib/importWeeks'

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
