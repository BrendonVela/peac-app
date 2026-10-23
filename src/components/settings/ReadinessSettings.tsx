'use client'

import { useState } from 'react'
import { HeartPulse } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { saveReadinessSettings } from '@/app/actions/coachSettings'

export function ReadinessSettings({ initial }: { initial: { on: boolean; low: number; cut: number } }) {
  const [on, setOn] = useState(initial.on)
  const [low, setLow] = useState(String(initial.low))
  const [cut, setCut] = useState(String(initial.cut))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)

  async function save() {
    setBusy(true); setMsg(null)
    const res = await saveReadinessSettings(on, Number(low), Number(cut))
    setBusy(false)
    setMsg(res && 'error' in res && res.error ? { t: res.error, ok: false } : { t: 'Saved', ok: true })
  }

  const field = 'w-16 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="w-4 h-4 text-blue-400" /> Readiness adjustments</CardTitle></CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-sm text-zinc-400">
          When an athlete&apos;s daily check-in is low, their workout weights drop automatically. They can switch back to full weights.
        </p>
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" checked={on} onChange={e => setOn(e.target.checked)} className="w-4 h-4 accent-blue-600" />
          Turn on for my athletes
        </label>
        <div className={`flex flex-wrap items-center gap-2 text-sm text-zinc-300 ${on ? '' : 'opacity-40 pointer-events-none'}`}>
          When readiness is below
          <input value={low} onChange={e => setLow(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={field} />
          out of 10, lower weights by
          <input value={cut} onChange={e => setCut(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={field} />
          %
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={save} loading={busy}>Save</Button>
          {msg && <span className={`text-xs ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.t}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
