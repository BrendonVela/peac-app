// Custom forms / questionnaires shared types and helpers

import { todayISO, startOfWeek } from './schedule'

export type QuestionType = 'scale' | 'yesno' | 'text' | 'number' | 'choice'

export interface Question {
  id: string
  label: string
  type: QuestionType
  options?: string[]
  required?: boolean
}

export interface FormRow {
  id: string
  coach_id: string
  title: string
  description: string | null
  frequency: 'once' | 'daily' | 'weekly'
  questions: Question[]
  group_id: string | null
  active: boolean
  created_at: string
}

export const FREQ_LABEL: Record<FormRow['frequency'], string> = {
  once: 'One time',
  daily: 'Every day',
  weekly: 'Every week',
}

export const TYPE_LABEL: Record<QuestionType, string> = {
  scale: '1–10 scale',
  yesno: 'Yes / No',
  text: 'Short answer',
  number: 'Number',
  choice: 'Multiple choice',
}

/** Which "slot" a response belongs to: once, today, or this week */
export function currentPeriod(freq: FormRow['frequency']): string {
  if (freq === 'daily') return todayISO()
  if (freq === 'weekly') return `week-${startOfWeek(todayISO())}`
  return 'once'
}

export function formatAnswer(q: Question, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (q.type === 'yesno') return v ? 'Yes' : 'No'
  return String(v)
}
