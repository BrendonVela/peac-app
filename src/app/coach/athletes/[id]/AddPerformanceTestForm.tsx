'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { Input } from '@/components/ui/Input'
import { addPerformanceTest } from '@/app/actions/performance'
import { todayISO } from '@/lib/schedule'
import { TEST_UNITS, type TestDef } from '@/lib/tests'

export function AddPerformanceTestForm({ athleteId, tests }: { athleteId: string; tests: TestDef[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [type, setType] = useState(tests[0]?.key ?? 'new')
  const [unit, setUnit] = useState('sec')
  const isNew = type === 'new'
  const builtIn = tests.filter(t => !t.custom)
  const custom = tests.filter(t => t.custom)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await addPerformanceTest(athleteId, new FormData(e.currentTarget))
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setOpen(false)
      setLoading(false)
      if (isNew) setType(tests[0]?.key ?? 'new')
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" />
        Add Test
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Performance Test">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="Test Type" name="test_type" required value={type} onChange={e => setType(e.target.value)}>
            {builtIn.map(t => (
              <option key={t.key} value={t.key}>{t.label} ({t.unit})</option>
            ))}
            {custom.length > 0 && (
              <optgroup label="Your tests">
                {custom.map(t => (
                  <option key={t.key} value={t.key}>{t.label}{t.unit ? ` (${t.unit})` : ''}</option>
                ))}
              </optgroup>
            )}
            <option value="new">➕ Add a new test…</option>
          </Select>

          {isNew && (
            <div className="space-y-3 rounded-lg border border-blue-600/30 bg-blue-600/5 p-3">
              <Input label="New test name" name="new_label" placeholder="e.g. 5-10-5 Shuttle, Max Pull-ups, Bat Speed" required autoFocus />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">Unit</label>
                  <input
                    name="new_unit"
                    list="test-units"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="sec, in, lbs…"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="test-units">
                    {TEST_UNITS.map(u => <option key={u} value={u} />)}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">Better is</label>
                  <select
                    name="new_better"
                    defaultValue="higher"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="higher">Higher (jumps, reps)</option>
                    <option value="lower">Lower (times)</option>
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500">It&apos;s saved to your team&apos;s list, so it shows in this menu from now on — and on progress charts and the leaderboard.</p>
            </div>
          )}

          <Input
            label="Result"
            name="result"
            type="number"
            step="any"
            placeholder="0.00"
            required
          />
          <Input
            label="Date"
            name="date"
            type="date"
            defaultValue={todayISO()}
            required
          />
          <Input label="Notes (optional)" name="notes" placeholder="Any notes..." />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              Save Test
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
