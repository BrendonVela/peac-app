'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { resetAthleteData, deleteAthlete } from '@/app/actions/admin'

export function ManageAthlete({ athleteId, name, isAdmin }: { athleteId: string; name: string; isAdmin: boolean }) {
  const router = useRouter()
  const [dialog, setDialog] = useState<'reset' | 'delete' | null>(null)
  const [checkins, setCheckins] = useState(false)
  const [tests, setTests] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function open(d: 'reset' | 'delete') { setDialog(d); setError(''); setConfirmText(''); setCheckins(false); setTests(false) }

  async function doReset() {
    setBusy(true); setError('')
    const res = await resetAthleteData(athleteId, checkins, tests)
    setBusy(false)
    if (res && 'error' in res && res.error) { setError(res.error); return }
    setDialog(null)
    router.refresh()
  }

  async function doDelete() {
    setBusy(true); setError('')
    const res = await deleteAthlete(athleteId)
    setBusy(false)
    if (res && 'error' in res && res.error) { setError(res.error); return }
    router.push('/coach/athletes')
    router.refresh()
  }

  return (
    <Card className="border-red-500/20">
      <CardHeader><CardTitle>Manage athlete</CardTitle></CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-white">Reset training data</p>
            <p className="text-xs text-zinc-500">Clear logged sets, warm-ups and moved days. Good for test accounts or a fresh start.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => open('reset')}><RotateCcw className="w-3.5 h-3.5" /> Reset</Button>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800">
            <div className="min-w-0">
              <p className="text-sm text-white">Delete athlete</p>
              <p className="text-xs text-zinc-500">Permanently delete this athlete, their login and all their data.</p>
            </div>
            <Button size="sm" variant="danger" onClick={() => open('delete')}><Trash2 className="w-3.5 h-3.5" /> Delete</Button>
          </div>
        )}
      </CardContent>

      <Modal open={dialog === 'reset'} onClose={() => setDialog(null)} title="Reset training data">
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">
            Clears <strong>{name}</strong>&apos;s logged sets, warm-up checks and moved workout days. Their account, programs and maxes stay.
          </p>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={checkins} onChange={e => setCheckins(e.target.checked)} /> Also delete daily check-ins
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={tests} onChange={e => setTests(e.target.checked)} /> Also delete performance tests
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="danger" className="flex-1" loading={busy} onClick={doReset}>Clear data</Button>
          </div>
        </div>
      </Modal>

      <Modal open={dialog === 'delete'} onClose={() => setDialog(null)} title="Delete athlete">
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">
            This permanently deletes <strong>{name}</strong>, their login, and all their workouts, check-ins, tests and messages. This can&apos;t be undone.
          </p>
          <div className="space-y-1.5">
            <label className="block text-xs text-zinc-400">Type <span className="font-semibold text-white">{name}</span> to confirm</label>
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="danger" className="flex-1" loading={busy}
              disabled={confirmText.trim().toLowerCase() !== name.trim().toLowerCase()} onClick={doDelete}>
              Delete athlete
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
