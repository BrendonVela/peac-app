'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { Input } from '@/components/ui/Input'
import { addPerformanceTest } from '@/app/actions/performance'
import { ALL_TEST_TYPES, TEST_META } from '@/lib/utils'

export function AddPerformanceTestForm({ athleteId }: { athleteId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
          <Select label="Test Type" name="test_type" required>
            {ALL_TEST_TYPES.map(t => (
              <option key={t} value={t}>
                {TEST_META[t].label} ({TEST_META[t].unit})
              </option>
            ))}
          </Select>
          <Input
            label="Result"
            name="result"
            type="number"
            step="0.01"
            placeholder="0.00"
            required
          />
          <Input
            label="Date"
            name="date"
            type="date"
            defaultValue={new Date().toISOString().split('T')[0]}
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
