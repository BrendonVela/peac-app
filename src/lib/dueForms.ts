import { currentPeriod, type FormRow } from './forms'

/** Forms this athlete still needs to fill in for the current day/week (or ever, for one-time forms) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMyForms(supabase: any, athleteId: string) {
  const { data: forms, error } = await supabase.rpc('my_forms')
  if (error || !forms) return { due: [] as FormRow[], done: [] as FormRow[] }
  const list = forms as FormRow[]
  const { data: resp } = await supabase
    .from('form_responses')
    .select('form_id, period')
    .eq('athlete_id', athleteId)
    .in('form_id', list.map(f => f.id).length ? list.map(f => f.id) : ['00000000-0000-0000-0000-000000000000'])
  const have = new Set((resp ?? []).map((r: any) => `${r.form_id}|${r.period}`))
  const due = list.filter(f => !have.has(`${f.id}|${currentPeriod(f.frequency)}`))
  const done = list.filter(f => have.has(`${f.id}|${currentPeriod(f.frequency)}`))
  return { due, done }
}
