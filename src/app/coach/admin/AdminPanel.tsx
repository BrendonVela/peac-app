'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldCheck, Trash2, KeyRound, Copy, Check, UserPlus, RotateCcw, Search, ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  createCoachInvite, deleteCoachInvite, setAdmin, moveAthlete,
  deleteAthlete, deleteCoach, resetAthleteData,
} from '@/app/actions/admin'

export interface Person {
  kind: 'coach' | 'athlete'
  id: string
  user_id: string | null
  name: string
  email: string | null
  coach_id: string | null
  coach_name: string | null
  is_admin: boolean
  athlete_count: number
  created_at: string
  last_sign_in_at: string | null
}

export interface CoachInvite {
  code: string
  note: string | null
  created_at: string
  expires_at: string
  used_by: string | null
  used_at: string | null
}

function fmt(ts: string | null) {
  if (!ts) return 'Never'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const selectCls =
  'bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

type Dialog =
  | { type: 'deleteAthlete'; p: Person }
  | { type: 'deleteCoach'; p: Person }
  | { type: 'reset'; p: Person }
  | null

export function AdminPanel({ people, invites, myCoachId }: { people: Person[]; invites: CoachInvite[]; myCoachId: string | null }) {
  const router = useRouter()
  const coaches = people.filter(p => p.kind === 'coach').sort((a, b) => a.name.localeCompare(b.name))
  const athletes = people.filter(p => p.kind === 'athlete').sort((a, b) => a.name.localeCompare(b.name))

  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [confirmText, setConfirmText] = useState('')
  const [transferTo, setTransferTo] = useState<string>('')
  const [resetCheckins, setResetCheckins] = useState(false)
  const [resetTests, setResetTests] = useState(false)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const filteredAthletes = useMemo(() => {
    const q = search.toLowerCase()
    return athletes.filter(a =>
      a.name.toLowerCase().includes(q) || (a.email ?? '').toLowerCase().includes(q) || (a.coach_name ?? '').toLowerCase().includes(q)
    )
  }, [athletes, search])

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  async function run(key: string, fn: () => Promise<any>, okText: string) {
    setBusy(key)
    const res = await fn()
    setBusy(null)
    if (res && 'error' in res && res.error) { flash(res.error, false); return false }
    flash(okText)
    router.refresh()
    return true
  }

  async function sendReset(p: Person) {
    if (!p.email) return
    if (!confirm(`Send a password-reset email to ${p.email}?`)) return
    setBusy(`reset-pw-${p.id}`)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(p.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(null)
    flash(error ? error.message : `Reset email sent to ${p.email}`, !error)
  }

  function inviteLink(c: string) {
    return `${window.location.origin}/join-coach/${c}`
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch { flash('Could not copy', false) }
  }

  function openDialog(d: Dialog) {
    setConfirmText('')
    setTransferTo(myCoachId ?? '')
    setResetCheckins(false)
    setResetTests(false)
    setDialog(d)
  }

  const now = Date.now()

  return (
    <div className="space-y-6">
      {msg && (
        <div className={cn(
          'fixed top-4 right-4 z-50 rounded-lg px-4 py-2.5 text-sm shadow-xl border',
          msg.ok ? 'bg-green-950 border-green-700 text-green-300' : 'bg-red-950 border-red-700 text-red-300'
        )}>
          {msg.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Coaches', coaches.length],
          ['Athletes', athletes.length],
          ['Unassigned athletes', athletes.filter(a => !a.coach_id).length],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardContent className="py-4">
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-zinc-500">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coach invites */}
      <Card>
        <CardHeader>
          <CardTitle>Invite a coach</CardTitle>
          <p className="text-xs text-zinc-500 mt-1">Each link works once and expires after 14 days. Athletes use the invite link on your Athletes page instead.</p>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Who is it for? (optional, e.g. Coach Smith)"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              size="sm"
              loading={busy === 'invite'}
              onClick={async () => {
                const ok = await run('invite', () => createCoachInvite(note), 'Coach invite created')
                if (ok) setNote('')
              }}
            >
              <UserPlus className="w-4 h-4" /> Create coach invite
            </Button>
          </div>

          {invites.length > 0 && (
            <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg">
              {invites.map(inv => {
                const used = !!inv.used_at
                const expired = !used && new Date(inv.expires_at).getTime() < now
                return (
                  <div key={inv.code} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-mono truncate">/join-coach/{inv.code}</p>
                      <p className="text-xs text-zinc-500">
                        {inv.note ? `${inv.note} · ` : ''}
                        {used ? `Used ${fmt(inv.used_at)}` : expired ? `Expired ${fmt(inv.expires_at)}` : `Expires ${fmt(inv.expires_at)}`}
                      </p>
                    </div>
                    <Badge variant={used ? 'green' : expired ? 'default' : 'blue'}>{used ? 'Used' : expired ? 'Expired' : 'Active'}</Badge>
                    {!used && !expired && (
                      <button onClick={() => copy(inviteLink(inv.code), inv.code)} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                        {copied === inv.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied === inv.code ? 'Copied' : 'Copy link'}
                      </button>
                    )}
                    <button
                      onClick={() => run(`inv-${inv.code}`, () => deleteCoachInvite(inv.code), 'Invite removed')}
                      className="text-zinc-500 hover:text-red-400 p-1"
                      title="Remove invite"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coaches */}
      <Card>
        <CardHeader><CardTitle>Coaches</CardTitle></CardHeader>
        <CardContent className="px-0 py-0">
          <div className="divide-y divide-zinc-800">
            {coaches.map(c => {
              const isMe = c.id === myCoachId
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white flex items-center gap-2">
                      {c.name}
                      {c.is_admin && <Badge variant="purple"><ShieldCheck className="w-3 h-3 mr-1" />Admin</Badge>}
                      {isMe && <span className="text-xs text-zinc-500">(you)</span>}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {c.email ?? 'No login'} · {c.athlete_count} athlete{c.athlete_count === 1 ? '' : 's'} · Last sign-in {fmt(c.last_sign_in_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => run(`admin-${c.id}`, () => setAdmin(c.id, !c.is_admin), c.is_admin ? 'Admin removed' : 'Made admin')}
                      disabled={busy === `admin-${c.id}`}
                      className="text-xs px-2.5 py-1.5 rounded-md border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500"
                    >
                      {c.is_admin ? 'Remove admin' : 'Make admin'}
                    </button>
                    {c.email && (
                      <button onClick={() => sendReset(c)} className="text-zinc-500 hover:text-white p-1.5" title="Send password reset">
                        <KeyRound className="w-4 h-4" />
                      </button>
                    )}
                    {!isMe && (
                      <button onClick={() => openDialog({ type: 'deleteCoach', p: c })} className="text-zinc-500 hover:text-red-400 p-1.5" title="Delete coach">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Athletes */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Athletes</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, coach"
              className="bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {filteredAthletes.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">No athletes found.</p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {filteredAthletes.map(a => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white flex items-center gap-2">
                      {a.coach_id === myCoachId ? (
                        <Link href={`/coach/athletes/${a.id}`} className="hover:text-blue-300 flex items-center gap-1">
                          {a.name} <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                        </Link>
                      ) : a.name}
                      {!a.coach_id && <Badge variant="yellow">Unassigned</Badge>}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {a.email ?? 'No login (added by coach)'} · Last sign-in {fmt(a.last_sign_in_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={a.coach_id ?? ''}
                      onChange={e => run(`move-${a.id}`, () => moveAthlete(a.id, e.target.value || null), 'Athlete moved')}
                      disabled={busy === `move-${a.id}`}
                      className={selectCls}
                      title="Coach"
                    >
                      <option value="">No coach</option>
                      {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={() => openDialog({ type: 'reset', p: a })} className="text-zinc-500 hover:text-amber-400 p-1.5" title="Reset training data">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    {a.email && (
                      <button onClick={() => sendReset(a)} className="text-zinc-500 hover:text-white p-1.5" title="Send password reset">
                        <KeyRound className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => openDialog({ type: 'deleteAthlete', p: a })} className="text-zinc-500 hover:text-red-400 p-1.5" title="Delete athlete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <Modal open={dialog?.type === 'deleteAthlete'} onClose={() => setDialog(null)} title="Delete athlete">
        {dialog?.type === 'deleteAthlete' && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-300">
              This permanently deletes <strong>{dialog.p.name}</strong>
              {dialog.p.email ? <> and their login (<span className="text-zinc-400">{dialog.p.email}</span>)</> : null},
              plus all their logged workouts, check-ins, tests and messages. This can&apos;t be undone.
            </p>
            <ConfirmInput name={dialog.p.name} value={confirmText} onChange={setConfirmText} />
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setDialog(null)}>Cancel</Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={confirmText.trim().toLowerCase() !== dialog.p.name.trim().toLowerCase()}
                loading={busy === 'dialog'}
                onClick={async () => { if (await run('dialog', () => deleteAthlete(dialog.p.id), 'Athlete deleted')) setDialog(null) }}
              >
                Delete athlete
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={dialog?.type === 'deleteCoach'} onClose={() => setDialog(null)} title="Delete coach">
        {dialog?.type === 'deleteCoach' && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-300">
              This permanently deletes <strong>{dialog.p.name}</strong> and their login. They have{' '}
              {dialog.p.athlete_count} athlete{dialog.p.athlete_count === 1 ? '' : 's'}.
            </p>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide">Their athletes and programs go to</label>
              <select value={transferTo} onChange={e => setTransferTo(e.target.value)} className={`${selectCls} w-full py-2.5 text-sm`}>
                {coaches.filter(c => c.id !== dialog.p.id).map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.id === myCoachId ? ' (you)' : ''}</option>
                ))}
                <option value="">Nobody — delete their programs, athletes become unassigned</option>
              </select>
            </div>
            <ConfirmInput name={dialog.p.name} value={confirmText} onChange={setConfirmText} />
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setDialog(null)}>Cancel</Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={confirmText.trim().toLowerCase() !== dialog.p.name.trim().toLowerCase()}
                loading={busy === 'dialog'}
                onClick={async () => { if (await run('dialog', () => deleteCoach(dialog.p.id, transferTo || null), 'Coach deleted')) setDialog(null) }}
              >
                Delete coach
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={dialog?.type === 'reset'} onClose={() => setDialog(null)} title="Reset training data">
        {dialog?.type === 'reset' && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-300">
              Clears <strong>{dialog.p.name}</strong>&apos;s logged sets, warm-up checks and moved workout days, so their
              calendar, charts and PRs start fresh. Their account, programs and maxes stay.
            </p>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={resetCheckins} onChange={e => setResetCheckins(e.target.checked)} />
              Also delete daily check-ins
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={resetTests} onChange={e => setResetTests(e.target.checked)} />
              Also delete performance tests
            </label>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setDialog(null)}>Cancel</Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={busy === 'dialog'}
                onClick={async () => {
                  if (await run('dialog', () => resetAthleteData(dialog.p.id, resetCheckins, resetTests), 'Training data cleared')) setDialog(null)
                }}
              >
                Clear data
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function ConfirmInput({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs text-zinc-400">
        Type <span className="font-semibold text-white">{name}</span> to confirm
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
      />
    </div>
  )
}
