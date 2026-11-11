'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HeartPulse } from 'lucide-react'
import { CheckInForm } from '@/components/CheckInForm'

/** First step of a workout: today's check-in (required). Weights then adjust to how the athlete feels. */
export function CheckInGate() {
  const router = useRouter()
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-blue-600/40 bg-blue-600/10 px-4 py-3">
        <HeartPulse className="w-5 h-5 mt-0.5 text-blue-300 shrink-0" />
        <div className="text-sm text-blue-50">
          <p className="font-semibold">Step 1: Check in</p>
          <p className="text-blue-100/80">How are you feeling today? This takes 20 seconds, and your weights adjust to it. Your workout opens right after.</p>
        </div>
      </div>
      {offline && (
        <button onClick={() => router.push('?checkin=skip')} className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          📶 No signal? <b>Start the workout anyway</b> — check in when you&apos;re back online.
        </button>
      )}
      <CheckInForm showHeader={false} submitLabel="Check in & start workout" onDone={() => router.refresh()} />
    </div>
  )
}
