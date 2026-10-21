'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { coachClearWorkout } from '@/app/actions/admin'

export function ClearWorkoutButton({ athleteId, workoutId }: { athleteId: string; workoutId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!confirm('Clear everything logged in this workout (all exercises and warm-up)?')) return
        setBusy(true)
        const res = await coachClearWorkout(athleteId, workoutId)
        setBusy(false)
        if (res && 'error' in res && res.error) { alert(res.error); return }
        router.refresh()
      }}
      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400"
    >
      <Trash2 className="w-3.5 h-3.5" /> {busy ? 'Clearing…' : 'Clear whole workout'}
    </button>
  )
}
