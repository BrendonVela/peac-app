'use client'

import { useMemo, useState } from 'react'
import { Shuffle, Check, Search } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { setExerciseAlternatives } from '@/app/actions/swaps'
import { cn } from '@/lib/utils'

interface Ex { id: string; title: string; category: string }

export function SwapOptions({ exercise, all, current, onSaved }: {
  exercise: Ex
  all: Ex[]
  current: string[]
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set(current))
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return all
      .filter(e => e.id !== exercise.id)
      .filter(e => !s || e.title.toLowerCase().includes(s))
      .sort((a, b) => Number(picked.has(b.id)) - Number(picked.has(a.id)) || Number(b.category === exercise.category) - Number(a.category === exercise.category) || a.title.localeCompare(b.title))
      .slice(0, 80)
  }, [all, q, picked, exercise])

  function toggle(id: string) {
    setPicked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function save() {
    setBusy(true); setError('')
    const res = await setExerciseAlternatives(exercise.id, Array.from(picked))
    setBusy(false)
    if (res && 'error' in res && res.error) { setError(res.error); return }
    setOpen(false)
    onSaved()
  }

  return (
    <>
      <button
        onClick={() => { setPicked(new Set(current)); setQ(''); setError(''); setOpen(true) }}
        className={cn('flex items-center gap-1 text-xs', current.length ? 'text-violet-300 hover:text-violet-200' : 'text-zinc-500 hover:text-white')}
        title="Exercises athletes can swap to"
      >
        <Shuffle className="w-3.5 h-3.5" /> {current.length ? `${current.length} swap${current.length === 1 ? '' : 's'}` : 'Add swaps'}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Swaps for ${exercise.title}`}>
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
            Athletes can swap to these when equipment is taken or something hurts. Swaps work both ways.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search exercises…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-800 divide-y divide-zinc-800">
            {list.map(e => (
              <button key={e.id} onClick={() => toggle(e.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-800/50">
                <span className={cn('w-5 h-5 rounded border flex items-center justify-center shrink-0', picked.has(e.id) ? 'bg-violet-600 border-violet-600 text-white' : 'border-zinc-600')}>
                  {picked.has(e.id) && <Check className="w-3.5 h-3.5" />}
                </span>
                <span className="flex-1 min-w-0 text-sm text-white truncate">{e.title}</span>
                <span className="text-[11px] text-zinc-500">{e.category}</span>
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">{picked.size} selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={save} loading={busy}>Save swaps</Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}
