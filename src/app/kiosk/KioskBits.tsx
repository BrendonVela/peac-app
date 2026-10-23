'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Search } from 'lucide-react'
import { GroupsBar } from '@/components/groups/GroupsBar'
import type { Group } from '@/app/actions/groups'
import { cn } from '@/lib/utils'

/** Press and hold for 2 seconds to leave the tablet mode (stops athletes wandering into the coach account) */
export function HoldToExit() {
  const router = useRouter()
  const [progress, setProgress] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  function start() {
    stop()
    const began = Date.now()
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - began) / 2000)
      setProgress(p)
      if (p >= 1) { stop(); router.push('/coach/dashboard') }
    }, 50)
  }
  function stop() {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    setProgress(0)
  }

  return (
    <button
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onContextMenu={e => e.preventDefault()}
      className="relative overflow-hidden flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-500 select-none"
    >
      <span className="absolute inset-y-0 left-0 bg-red-600/30" style={{ width: `${progress * 100}%` }} />
      <LogOut className="relative w-3.5 h-3.5" />
      <span className="relative">Hold to exit</span>
    </button>
  )
}

/** Go back to the athlete list after a few idle minutes so the next athlete starts fresh */
export function IdleReturn({ to = '/kiosk', minutes = 3 }: { to?: string; minutes?: number }) {
  const router = useRouter()
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(t)
      t = setTimeout(() => router.push(to), minutes * 60 * 1000)
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => { clearTimeout(t); events.forEach(e => window.removeEventListener(e, reset)) }
  }, [router, to, minutes])
  return null
}

export function AthleteTiles({ athletes }: { athletes: { id: string; name: string; today: number }[] }) {
  const [q, setQ] = useState('')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const allowed = groupId ? new Set(groups.find(g => g.id === groupId)?.athleteIds ?? []) : null
  const shown = athletes.filter(a => (!allowed || allowed.has(a.id)) && a.name.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Find your name…"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <GroupsBar athletes={athletes} selected={groupId} onSelect={setGroupId} onGroups={setGroups} readOnly />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {shown.map(a => (
          <Link
            key={a.id}
            href={`/kiosk/${a.id}`}
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 active:scale-[0.98] transition-transform hover:border-blue-600/50"
          >
            <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center text-blue-300 font-bold mb-3">
              {a.name.slice(0, 2).toUpperCase()}
            </div>
            <p className="text-lg font-semibold text-white leading-tight">{a.name}</p>
            <p className={cn('text-sm mt-1', a.today ? 'text-green-400' : 'text-zinc-500')}>
              {a.today ? `${a.today} workout${a.today > 1 ? 's' : ''} today` : 'Nothing today'}
            </p>
          </Link>
        ))}
        {shown.length === 0 && <p className="col-span-full text-center text-zinc-500 py-10">No athletes found.</p>}
      </div>
    </div>
  )
}
