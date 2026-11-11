// Performance tests: the built-in ones plus each team's own (custom_tests table, key "custom:<id>")
import { TEST_META, ALL_TEST_TYPES } from './utils'

export interface TestDef { key: string; label: string; unit: string; higherIsBetter: boolean; custom?: boolean }

export const BUILT_IN_TESTS: TestDef[] = ALL_TEST_TYPES.map(k => ({ key: k, ...TEST_META[k] }))

export const TEST_UNITS = ['sec', 'in', 'ft', 'lbs', 'reps', 'm', 'mph', 'cm', 'kg', 'pts'] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function customToDef(r: any): TestDef {
  return { key: `custom:${r.id}`, label: r.label, unit: r.unit ?? '', higherIsBetter: !!r.higher_is_better, custom: true }
}

/** Built-in tests + this coach's own tests (never fails: custom list is skipped if the table isn't set up yet) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadTestDefs(supabase: any, coachId: string | null | undefined): Promise<TestDef[]> {
  if (!coachId) return BUILT_IN_TESTS
  const { data, error } = await supabase.from('custom_tests').select('id, label, unit, higher_is_better').eq('coach_id', coachId).order('label')
  return [...BUILT_IN_TESTS, ...(error ? [] : (data ?? []).map(customToDef))]
}

export function findTest(defs: TestDef[], key: string): TestDef | undefined {
  return defs.find(d => d.key === key)
}
