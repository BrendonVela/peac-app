'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { assignProgram, unassignProgram } from '@/app/actions/programs'
import type { Athlete } from '@/types'

interface Props {
  programId: string
  athletes: Pick<Athlete, 'id' | 'name' | 'sport'>[]
  assignedIds: string[]
}

export function AssignProgramForm({ programId, athletes, assignedIds }: Props) {
  const [assigned, setAssigned] = useState(new Set(assignedIds))
  const [loading, setLoading] = useState<string | null>(null)

  async function toggle(athleteId: string) {
    setLoading(athleteId)
    if (assigned.has(athleteId)) {
      await unassignProgram(programId, athleteId)
      setAssigned(prev => { const next = new Set(prev); next.delete(athleteId); return next })
    } else {
      await assignProgram(programId, athleteId)
      setAssigned(prev => new Set([...prev, athleteId]))
    }
    setLoading(null)
  }

  if (athletes.length === 0) {
    return <p className="text-sm text-zinc-500">Add athletes first to assign this program.</p>
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {athletes.map(athlete => {
        const isAssigned = assigned.has(athlete.id)
        return (
          <button
            key={athlete.id}
            onClick={() => toggle(athlete.id)}
            disabled={loading === athlete.id}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left',
              isAssigned
                ? 'bg-blue-600/15 border-blue-600/40 text-blue-300'
                : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600',
              loading === athlete.id && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className={cn('w-2 h-2 rounded-full shrink-0', isAssigned ? 'bg-blue-400' : 'bg-zinc-600')} />
            <div className="min-w-0">
              <p className="truncate">{athlete.name}</p>
              {athlete.sport && <p className="text-xs opacity-60 truncate">{athlete.sport}</p>}
            </div>
          </button>
        )
      })}
    </div>
  )
}
