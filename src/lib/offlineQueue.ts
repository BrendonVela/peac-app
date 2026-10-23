'use client'

// Saves made while offline wait in this phone's storage and are sent when the signal comes back.

import { logWorkoutResult, saveWarmupProgress, saveWorkoutSession } from '@/app/actions/workouts'
import { setWorkoutSwap } from '@/app/actions/swaps'

const KEY = 'peac_offline_queue'
export const QUEUE_EVENT = 'peac:offline-queue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ACTIONS: Record<string, (...args: any[]) => Promise<any>> = {
  logWorkoutResult,
  saveWarmupProgress,
  saveWorkoutSession,
  setWorkoutSwap,
}
export type QueuedName = keyof typeof ACTIONS

interface Item { id: string; name: string; args: unknown[]; at: number }

function read(): Item[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function write(items: Item[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* storage full or blocked */ }
  window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail: items.length }))
}

export function pendingCount(): number {
  return typeof window === 'undefined' ? 0 : read().length
}

/**
 * Run a save now if we can; if the phone is offline (or the request fails), keep it for later.
 * `dedupeKey` lets a newer save of the same thing replace an older queued one.
 * Returns 'saved' or 'queued'.
 */
export async function saveOrQueue(name: QueuedName, args: unknown[], dedupeKey: string): Promise<'saved' | 'queued'> {
  const fn = ACTIONS[name]
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      await fn(...args)
      return 'saved'
    } catch { /* fall through to queue */ }
  }
  const id = `${name}:${dedupeKey}`
  write([...read().filter(i => i.id !== id), { id, name, args, at: Date.now() }])
  return 'queued'
}

let flushing = false
export async function flushQueue(): Promise<number> {
  if (flushing || typeof navigator === 'undefined' || !navigator.onLine) return 0
  flushing = true
  let sent = 0
  try {
    for (const item of read().sort((a, b) => a.at - b.at)) {
      const fn = ACTIONS[item.name]
      if (!fn) { write(read().filter(i => i.id !== item.id)); continue }
      try {
        await fn(...item.args)
        write(read().filter(i => i.id !== item.id || i.at !== item.at))
        sent++
      } catch {
        break // still no connection — try again later
      }
    }
  } finally {
    flushing = false
  }
  return sent
}
