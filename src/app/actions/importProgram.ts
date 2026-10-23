'use server'

import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { redirect } from 'next/navigation'
import { parseExcelProgram } from '@/lib/parseExcelProgram'
import { importWeeks } from '@/lib/importWeeks'


export async function importProgramFromExcel(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .match(await coachMatch(supabase, user.id))
    .single()
  if (!coach) throw new Error('Coach profile not found')

  const file = formData.get('file') as File
  if (!file) throw new Error('No file uploaded')

  const buffer = await file.arrayBuffer()
  let weeks
  try {
    weeks = parseExcelProgram(buffer)
  } catch (e: any) {
    throw new Error(`Failed to parse file: ${e.message}`)
  }

  if (weeks.length === 0) {
    throw new Error('No program data found in this file. Check the format matches the expected template.')
  }

  const rawName = file.name.replace(/\.xlsx?$/i, '').replace(/^Copy[_ ]of[_ ]/i, '').replace(/_/g, ' ')
  const programId = await importWeeks(supabase, coach.id, weeks, rawName, 'Imported from Excel')
  redirect(`/coach/programs/${programId}`)
}
