'use client'

import { useState } from 'react'
import { Check, ChevronDown, Flame } from 'lucide-react'
import { saveOrQueue } from '@/lib/offlineQueue'
import { cn } from '@/lib/utils'

interface Props {
  athleteId: string
  workoutId: string
  title: string
  items: string[]
  initialDone: number[]
}

export function WarmupChecklist({ athleteId, workoutId, title, items, initialDone }: Props) {
  const [done, setDone] = useState<Set<number>>(new Set(initialDone))
  const allDone = items.length > 0 && done.size >= items.length
  const [open, setOpen] = useState(!allDone)

  function toggle(i: number) {
    const next = new Set(done)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setDone(next)
    saveOrQueue('saveWarmupProgress', [athleteId, workoutId, Array.from(next).sort((a, b) => a - b)], `${athleteId}:${workoutId}`)
    if (next.size >= items.length) setOpen(false)
  }

  // Split "Hip Airplane Drill — 3×5 each side" into name + details
  function split(text: string): [string, string] {
    const idx = text.indexOf(' — ')
    return idx > 0 ? [text.slice(0, idx), text.slice(idx + 3)] : [text, '']
  }

  return (
    <div className={cn('rounded-xl border overflow-hidden', allDone ? 'border-green-600/30' : 'border-orange-500/30')}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-4 py-3 text-left',
          allDone ? 'bg-green-500/[0.06]' : 'bg-orange-500/[0.06]'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {allDone
            ? <Check className="w-4 h-4 text-green-400 shrink-0" />
            : <Flame className="w-4 h-4 text-orange-400 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{title.replace(/protocol/i, '').trim() || 'Warm-up'}</p>
            <p className="text-xs text-zinc-500">{done.size} of {items.length} done</p>
          </div>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-zinc-500 transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="divide-y divide-zinc-800 border-t border-zinc-800">
          {items.map((item, i) => {
            const [name, detail] = split(item)
            const checked = done.has(i)
            return (
              <button
                key={i}
                onClick={() => toggle(i)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-zinc-800/40 transition-colors"
              >
                <span
                  className={cn(
                    'mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                    checked ? 'bg-green-600 border-green-600 text-white' : 'border-zinc-600 text-transparent'
                  )}
                >
                  <Check className="w-3.5 h-3.5" />
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-sm', checked ? 'text-zinc-500 line-through' : 'text-white')}>{name}</span>
                  {detail && <span className="block text-xs text-zinc-500 mt-0.5">{detail}</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
