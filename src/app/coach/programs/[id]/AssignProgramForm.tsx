'use client'

import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { listGroups, assignProgramToGroup, type Group } from '@/app/actions/groups'
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
  const [groups, setGroups] = useState<Group[]>([])
  const [groupMsg, setGroupMsg] = useState('')

  useEffect(() => { listGroups().then(setGroups) }, [])

  async function assignGroup(g: Group) {
    if (!confirm(`Assign this program to everyone in "${g.name}" (${g.athleteIds.length})?`)) return
    setLoading(`g-${g.id}`); setGroupMsg('')
    const res = await assignProgramToGroup(programId, g.id)
    setLoading(null)
    if ('error' in res && res.error) { setGroupMsg(res.error); return }
    if ('ids' in res && res.ids) {
      setAssigned(prev => { const next = new Set<string>(prev); res.ids!.forEach(id => next.add(id)); return next })
      setGroupMsg(`Assigned to ${res.added} new athlete${res.added === 1 ? '' : 's'} in ${g.name}.`)
    }
  }

  async function toggle(athleteId: string) {
    setLoading(athleteId)
    if (assigned.has(athleteId)) {
      await unassignProgram(programId, athleteId)
      setAssigned(prev => { const next = new Set(prev); next.delete(athleteId); return next })
    } else {
      await assignProgram(programId, athleteId)
      setAssigned(prev => { const next = new Set<string>(prev); next.add(athleteId); return next })
    }
    setLoading(null)
  }

  if (athletes.length === 0) {
    return <p className="text-sm text-zinc-500">Add athletes first to assign this program.</p>
  }

  return (
    <div className="space-y-3">
    {groups.length > 0 && (
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-zinc-500"><Users className="w-3.5 h-3.5" /> Assign a whole group:</span>
        {groups.map(g => (
          <button
            key={g.id}
            onClick={() => assignGroup(g)}
            disabled={loading === `g-${g.id}`}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:text-white hover:border-blue-500 disabled:opacity-50"
          >
            {g.name} ({g.athleteIds.length})
          </button>
        ))}
        {groupMsg && <span className="text-xs text-green-400">{groupMsg}</span>}
      </div>
    )}
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
    </div>
  )
}
