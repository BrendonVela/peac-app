// Deep copy of a program (weeks, days, exercises). Server-only.
import { randomUUID } from 'crypto'
import { fetchAll, chunk } from './fetchAll'

export async function copyProgram(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sourceId: string,
  fields: { coach_id: string; title: string; description: string | null; is_template: boolean; is_public_template?: boolean }
): Promise<{ id?: string; error?: string }> {
  const [{ data: blocks, error: bErr }, { data: workouts, error: wErr }] = await Promise.all([
    supabase.from('training_blocks').select('*').eq('program_id', sourceId),
    supabase.from('workouts').select('*').eq('program_id', sourceId),
  ])
  if (bErr || wErr) return { error: (bErr ?? wErr).message }

  const wxRows: any[] = []
  for (const ids of chunk((workouts ?? []).map((w: any) => w.id), 60)) {
    const { data, error } = await fetchAll<any>((from, to) =>
      supabase.from('workout_exercises').select('*').in('workout_id', ids).range(from, to))
    if (error) return { error: error.message }
    wxRows.push(...data)
  }

  const newId = randomUUID()
  const blockMap = new Map<string, string>()
  const workoutMap = new Map<string, string>()
  ;(blocks ?? []).forEach((b: any) => blockMap.set(b.id, randomUUID()))
  ;(workouts ?? []).forEach((w: any) => workoutMap.set(w.id, randomUUID()))
  const strip = ({ id: _i, created_at: _c, ...rest }: any) => rest

  const { error: pErr } = await supabase.from('programs').insert({
    id: newId,
    coach_id: fields.coach_id,
    title: fields.title,
    description: fields.description,
    is_template: fields.is_template,
    is_public_template: !!fields.is_public_template,
  })
  if (pErr) return { error: pErr.message }

  const fail = async (msg: string) => {
    await supabase.from('programs').delete().eq('id', newId)
    return { error: msg }
  }
  for (const part of chunk((blocks ?? []).map((b: any) => ({ ...strip(b), id: blockMap.get(b.id), program_id: newId })), 200)) {
    const { error } = await supabase.from('training_blocks').insert(part)
    if (error) return fail(error.message)
  }
  const newWorkouts = (workouts ?? []).map((w: any) => ({
    ...strip(w),
    id: workoutMap.get(w.id),
    program_id: newId,
    block_id: w.block_id ? blockMap.get(w.block_id) ?? null : null,
  }))
  for (const part of chunk(newWorkouts, 200)) {
    const { error } = await supabase.from('workouts').insert(part)
    if (error) return fail(error.message)
  }
  for (const part of chunk(wxRows.map(x => ({ ...strip(x), workout_id: workoutMap.get(x.workout_id) })), 400)) {
    const { error } = await supabase.from('workout_exercises').insert(part)
    if (error) return fail(error.message)
  }
  return { id: newId }
}
