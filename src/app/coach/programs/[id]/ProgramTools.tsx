'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, SlidersHorizontal } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { duplicateProgramForAthlete, scaleProgramWeights } from '@/app/actions/programTools'
import { LIFTS, type LiftKey } from '@/lib/maxes'

interface Props {
  programId: string
  athletes: { id: string; name: string }[]
}

const selectCls =
  'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

export function ProgramTools({ programId, athletes }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'dup' | 'scale' | null>(null)
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? '')
  const [lift, setLift] = useState<LiftKey | 'all'>('squat')
  const [percent, setPercent] = useState('95')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  function close() { setMode(null); setMsg('') }

  async function duplicate() {
    if (!athleteId) return
    setBusy(true); setMsg('')
    const res = await duplicateProgramForAthlete(programId, athleteId)
    setBusy(false)
    if (res && 'error' in res && res.error) { setMsg(res.error); return }
    if (res && 'id' in res && res.id) router.push(`/coach/programs/${res.id}`)
  }

  async function scale() {
    setBusy(true); setMsg('')
    const res = await scaleProgramWeights(programId, lift, Number(percent))
    setBusy(false)
    if (res && 'error' in res && res.error) { setMsg(res.error); return }
    setMsg(`Updated ${(res as any).count} exercises.`)
    router.refresh()
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setMode('dup')}>
          <Copy className="w-3.5 h-3.5" /> Duplicate for athlete
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setMode('scale')}>
          <SlidersHorizontal className="w-3.5 h-3.5" /> Adjust weights
        </Button>
      </div>

      <Modal open={mode === 'dup'} onClose={close} title="Duplicate for athlete">
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Makes a personal copy of this program for one athlete and assigns it to them.
            If they&apos;re on this program now, they move to the copy and keep their start date.
          </p>
          {athletes.length === 0 ? (
            <p className="text-sm text-zinc-500">Add athletes first.</p>
          ) : (
            <select value={athleteId} onChange={e => setAthleteId(e.target.value)} className={selectCls}>
              {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          {msg && <p className="text-sm text-red-400">{msg}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={close}>Cancel</Button>
            <Button className="flex-1" loading={busy} disabled={!athleteId} onClick={duplicate}>Duplicate</Button>
          </div>
        </div>
      </Modal>

      <Modal open={mode === 'scale'} onClose={close} title="Adjust weights">
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Changes every matching weight in this program by a percent, rounded to 5 lb.
            100% = no change, 95% = 5% lighter, 110% = 10% heavier.
          </p>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide">Which weights</label>
              <select value={lift} onChange={e => setLift(e.target.value as LiftKey | 'all')} className={selectCls}>
                {LIFTS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                <option value="all">All weights in the program</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide">Percent</label>
              <div className="relative">
                <input
                  value={percent}
                  onChange={e => setPercent(e.target.value)}
                  type="number"
                  inputMode="decimal"
                  className={`${selectCls} pr-7`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">%</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Example: 210 lb at {percent || '—'}% → {percent ? Math.max(5, Math.round((210 * Number(percent)) / 100 / 5) * 5) : '—'} lb
          </p>
          {msg && <p className={`text-sm ${msg.startsWith('Updated') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={close}>Close</Button>
            <Button className="flex-1" loading={busy} onClick={scale}>Apply</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
