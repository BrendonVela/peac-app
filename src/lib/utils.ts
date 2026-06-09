import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { TestType } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const TEST_META: Record<TestType, { label: string; unit: string; higherIsBetter: boolean }> = {
  '10_yard':       { label: '10-Yard Sprint', unit: 'sec', higherIsBetter: false },
  '20_yard':       { label: '20-Yard Sprint', unit: 'sec', higherIsBetter: false },
  '40_yard':       { label: '40-Yard Sprint', unit: 'sec', higherIsBetter: false },
  'vertical_jump': { label: 'Vertical Jump',  unit: 'in',  higherIsBetter: true  },
  'broad_jump':    { label: 'Broad Jump',     unit: 'in',  higherIsBetter: true  },
  'pro_agility':   { label: 'Pro Agility',    unit: 'sec', higherIsBetter: false },
  'body_weight':   { label: 'Body Weight',    unit: 'lbs', higherIsBetter: false },
}

export const ALL_TEST_TYPES: TestType[] = [
  '10_yard', '20_yard', '40_yard', 'vertical_jump', 'broad_jump', 'pro_agility', 'body_weight',
]

export const EXERCISE_CATEGORIES = [
  'Speed', 'Strength', 'Plyometrics', 'Mobility', 'Conditioning', 'Recovery',
] as const

export const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
]

export function getReadinessColor(score: number) {
  if (score >= 7) return 'text-green-400'
  if (score >= 5) return 'text-yellow-400'
  return 'text-red-400'
}

export function getReadinessBadge(score: number) {
  if (score >= 7) return 'bg-green-500/10 text-green-400 border border-green-500/20'
  if (score >= 5) return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
  return 'bg-red-500/10 text-red-400 border border-red-500/20'
}

export function getReadinessLabel(score: number) {
  if (score >= 8) return 'High'
  if (score >= 6) return 'Moderate'
  if (score >= 4) return 'Low'
  return 'Very Low'
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
