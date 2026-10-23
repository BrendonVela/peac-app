'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Copy, Check, Trash2, UserMinus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createStaffInvite, deleteStaffInvite, removeStaff } from '@/app/actions/staff'

export function StaffPanel({ staff, invites }: {
  staff: { id: string; name: string; created_at: string }[]
  invites: { code: string; note: string | null; expires_at: string; used_at: string | null }[]
}) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')
  const open = invites.filter(i => !i.used_at && new Date(i.expires_at).getTime() > Date.now())

  async function make() {
    setBusy(true); setError('')
    const res = await createStaffInvite(note)
    setBusy(false)
    if ('error' in res && res.error) { setError(res.error); return }
    setNote('')
    router.refresh()
  }
  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join-coach/${code}`)
      setCopied(code); setTimeout(() => setCopied(null), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Invite an assistant coach</CardTitle>
          <p className="text-xs text-zinc-500 mt-1">The link works once and expires in 14 days. They open it and create their account.</p>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Who is it for? (optional)" className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <Button size="sm" onClick={make} loading={busy}><UserPlus className="w-4 h-4" /> Create invite link</Button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {open.length > 0 && (
            <div className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
              {open.map(i => (
                <div key={i.code} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex-1 min-w-0">
                    <span className="block font-mono text-sm text-white truncate">/join-coach/{i.code}</span>
                    <span className="block text-xs text-zinc-500">{i.note ? `${i.note} · ` : ''}expires {new Date(i.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </span>
                  <button onClick={() => copy(i.code)} className="flex items-center gap-1 text-xs text-blue-400">
                    {copied === i.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied === i.code ? 'Copied' : 'Copy link'}
                  </button>
                  <button onClick={async () => { await deleteStaffInvite(i.code); router.refresh() }} className="p-1 text-zinc-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Your staff</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {staff.length === 0 ? (
            <p className="text-sm text-zinc-500">No assistant coaches yet.</p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {staff.map(s => (
                <div key={s.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1 text-sm text-white">{s.name}</span>
                  <span className="text-xs text-zinc-500">Assistant</span>
                  <button
                    onClick={async () => { if (confirm(`Remove ${s.name} from your staff? They keep their login but lose access to your athletes.`)) { await removeStaff(s.id); router.refresh() } }}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-red-400"
                  >
                    <UserMinus className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
