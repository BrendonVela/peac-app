'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Link2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { mergeAthleteProfiles } from '@/app/actions/admin'

export interface SignedUpAthlete {
  id: string
  name: string
  created_at: string
}

export function LinkAccount({ athleteId, name, candidates }: { athleteId: string; name: string; candidates: SignedUpAthlete[] }) {
  const router = useRouter()
  const [pick, setPick] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const chosen = candidates.find(c => c.id === pick)

  async function merge() {
    setBusy(true); setError('')
    const res = await mergeAthleteProfiles(athleteId, pick)
    setBusy(false)
    if (res && 'error' in res && res.error) { setError(res.error); return }
    setOpen(false)
    router.refresh()
  }

  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Link2 className="w-4 h-4 text-amber-400" /> Not signed up yet</CardTitle>
        <p className="text-xs text-zinc-500 mt-1">
          {name} doesn&apos;t have a login. If they already made their own account, combine it with this profile so they keep the program, maxes and schedule you set up here.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {candidates.length === 0 ? (
          <p className="text-sm text-zinc-500">None of your athletes with an account are left to link. Send them your invite link instead.</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={pick}
              onChange={e => setPick(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Pick their account…</option>
              {candidates.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — signed up {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </option>
              ))}
            </select>
            <Button size="sm" disabled={!pick} onClick={() => { setError(''); setOpen(true) }}>
              <Link2 className="w-4 h-4" /> Combine
            </Button>
          </div>
        )}
      </CardContent>

      <Modal open={open} onClose={() => setOpen(false)} title="Combine athletes?">
        <div className="space-y-4 text-sm text-zinc-300">
          <p>
            <b className="text-white">{chosen?.name}</b>&apos;s login will be connected to <b className="text-white">{name}</b>.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-zinc-400">
            <li>Keeps this profile&apos;s programs, maxes, schedule and notes.</li>
            <li>Anything {chosen?.name} already logged on their account moves over too.</li>
            <li>The extra &ldquo;{chosen?.name}&rdquo; entry disappears from your list.</li>
          </ul>
          <p className="text-amber-300">Double-check it&apos;s the same person — this can&apos;t be undone.</p>
          {error && <p className="text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={merge} loading={busy}>Yes, combine</Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
