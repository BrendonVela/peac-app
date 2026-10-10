'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { saveAthleteMaxes } from '@/app/actions/maxes'
import { LIFTS } from '@/lib/maxes'

interface Props {
  athleteId: string
  initial: Record<string, number>
  updatedAt: string | null
}

export function MaxesForm({ athleteId, initial, updatedAt }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(LIFTS.map(l => [l.key, initial[l.key] != null ? String(initial[l.key]) : '']))
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const changed = LIFTS.some(l => (values[l.key] ?? '') !== (initial[l.key] != null ? String(initial[l.key]) : ''))

  async function save() {
    setSaving(true)
    setMsg('')
    const res = await saveAthleteMaxes(athleteId, values)
    setSaving(false)
    if (res && 'error' in res && res.error) {
      setMsg(res.error)
    } else {
      setMsg('Saved')
      router.refresh()
      setTimeout(() => setMsg(''), 2000)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {LIFTS.map(l => (
          <div key={l.key} className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-400">
              {l.label}
              {l.hint && <span className="block text-[10px] text-zinc-600 font-normal">{l.hint}</span>}
            </label>
            <div className="relative">
              <input
                value={values[l.key]}
                onChange={e => setValues(v => ({ ...v, [l.key]: e.target.value }))}
                type="number"
                inputMode="decimal"
                placeholder="—"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-3 pr-9 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">lb</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          Main-lift weights in their programs scale to these maxes. Leave blank to use the program&apos;s weights as written.
          {updatedAt && <> Last updated {new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.</>}
        </p>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-xs ${msg === 'Saved' ? 'text-green-400' : 'text-red-400'}`}>{msg}</span>}
          <Button size="sm" onClick={save} loading={saving} disabled={!changed}>Save maxes</Button>
        </div>
      </div>
    </div>
  )
}
