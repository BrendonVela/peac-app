'use client'

import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { flushQueue, pendingCount, QUEUE_EVENT } from '@/lib/offlineQueue'

/** Registers the service worker (offline pages + notifications) and syncs saves made offline */
export function OfflineSupport() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }
    setOnline(navigator.onLine)
    setPending(pendingCount())

    const sync = async () => {
      setSyncing(true)
      await flushQueue()
      setSyncing(false)
      setPending(pendingCount())
    }
    const onOnline = () => { setOnline(true); sync() }
    const onOffline = () => setOnline(false)
    const onQueue = (e: Event) => setPending((e as CustomEvent<number>).detail)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener(QUEUE_EVENT, onQueue)
    if (navigator.onLine && pendingCount() > 0) sync()
    const t = setInterval(() => { if (navigator.onLine && pendingCount() > 0) sync() }, 30000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener(QUEUE_EVENT, onQueue)
      clearInterval(t)
    }
  }, [])

  if (online && pending === 0) return null
  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-[60] pointer-events-none" style={{ top: 'calc(env(safe-area-inset-top) + 0.5rem)' }}>
      <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/95 px-3 py-1.5 text-xs text-zinc-200 shadow-lg backdrop-blur">
        {!online ? <WifiOff className="w-3.5 h-3.5 text-amber-400" /> : <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${syncing ? 'animate-spin' : ''}`} />}
        {!online
          ? pending > 0 ? `Offline — ${pending} save${pending === 1 ? '' : 's'} will sync` : 'Offline — keep logging, it will sync'
          : `Syncing ${pending} save${pending === 1 ? '' : 's'}…`}
      </div>
    </div>
  )
}
