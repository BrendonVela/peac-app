'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { KeyRound, Trash2, User, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { deleteMyAccount, updateMyName } from '@/app/actions/account'

interface Props {
  email: string
  name: string
  role: 'coach' | 'athlete'
  viewingAs: string | null
}

export function AccountSettings({ email, name, role, viewingAs }: Props) {
  const router = useRouter()
  const [nameValue, setNameValue] = useState(name)
  const [nameMsg, setNameMsg] = useState<{ t: string; ok: boolean } | null>(null)
  const [pwMsg, setPwMsg] = useState<{ t: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleteError, setDeleteError] = useState('')

  async function saveName() {
    setBusy('name'); setNameMsg(null)
    const res = await updateMyName(nameValue)
    setBusy(null)
    setNameMsg(res && 'error' in res && res.error ? { t: res.error, ok: false } : { t: 'Saved', ok: true })
    router.refresh()
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const pw = String(f.get('password') ?? '')
    const confirm = String(f.get('confirm') ?? '')
    if (pw.length < 6) { setPwMsg({ t: 'At least 6 characters.', ok: false }); return }
    if (pw !== confirm) { setPwMsg({ t: 'Passwords don’t match.', ok: false }); return }
    setBusy('pw'); setPwMsg(null)
    const { error } = await createClient().auth.updateUser({ password: pw })
    setBusy(null)
    if (error) { setPwMsg({ t: error.message, ok: false }); return }
    form.reset()
    setPwMsg({ t: 'Password updated', ok: true })
  }

  async function doDelete() {
    setBusy('delete'); setDeleteError('')
    const res = await deleteMyAccount()
    setBusy(null)
    if (res && 'error' in res && res.error) { setDeleteError(res.error); return }
    window.location.href = '/login?deleted=1'
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Signed in as {email}</p>
      </div>

      {viewingAs && (
        <p className="text-sm rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 px-3 py-2">
          You&apos;re viewing as {viewingAs}, but these settings are for <strong>your own</strong> account ({email}).
        </p>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-4 h-4 text-blue-400" /> Profile</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-3">
          <Input label="Name" value={nameValue} onChange={e => setNameValue(e.target.value)} />
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={saveName} loading={busy === 'name'} disabled={nameValue.trim() === name.trim()}>Save name</Button>
            {nameMsg && <span className={`text-xs ${nameMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{nameMsg.t}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-blue-400" /> Change password</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={changePassword} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="New password" name="password" type="password" minLength={6} required autoComplete="new-password" />
              <Input label="Confirm password" name="confirm" type="password" minLength={6} required autoComplete="new-password" />
            </div>
            <div className="flex items-center gap-3">
              <Button size="sm" type="submit" loading={busy === 'pw'}>Update password</Button>
              {pwMsg && <span className={`text-xs ${pwMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{pwMsg.t}</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-4 h-4 text-blue-400" /> Privacy</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <Link href="/privacy" className="text-sm text-blue-400 hover:text-blue-300">Read the PEAC Privacy Policy</Link>
        </CardContent>
      </Card>

      {!viewingAs && (
        <Card className="border-red-500/30">
          <CardHeader><CardTitle className="flex items-center gap-2 text-red-300"><Trash2 className="w-4 h-4" /> Delete account</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-3">
            <p className="text-sm text-zinc-400">
              {role === 'coach'
                ? 'Permanently deletes your coach account and the programs you created. Your athletes keep their accounts but will no longer have a coach.'
                : 'Permanently deletes your account and everything in it: logged workouts, check-ins, tests and messages.'}
              {' '}This can&apos;t be undone.
            </p>
            <Button variant="danger" size="sm" onClick={() => { setShowDelete(true); setConfirmText(''); setDeleteError('') }}>
              Delete my account
            </Button>
          </CardContent>
        </Card>
      )}

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete your account?">
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">This permanently deletes your PEAC account ({email}) and can&apos;t be undone.</p>
          <div className="space-y-1.5">
            <label className="block text-xs text-zinc-400">Type <span className="font-semibold text-white">DELETE</span> to confirm</label>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="danger" className="flex-1" loading={busy === 'delete'} disabled={confirmText.trim().toUpperCase() !== 'DELETE'} onClick={doDelete}>
              Delete forever
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
