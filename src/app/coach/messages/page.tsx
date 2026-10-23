'use client'

import { useEffect, useState, useRef } from 'react'
import { Send, ChevronLeft, ShieldCheck, Megaphone, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { sendMessage, markMessagesRead, broadcastMessage, adminDeleteMessage, adminDeleteConversation, type BroadcastAudience } from '@/app/actions/messages'
import { Modal } from '@/components/ui/Modal'
import { MessageAttachment } from '@/components/MessageAttachment'
import { VideoSendButton } from '@/components/VideoSendButton'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'

type Kind = 'admin' | 'coach' | 'athlete'

interface Thread {
  userId: string
  name: string
  subtitle: string | null
  kind: Kind
  lastMessage: string
  lastAt: string
  unread: number
}

const GROUPS: { kind: Kind; label: string }[] = [
  { kind: 'admin', label: 'PEAC Admin' },
  { kind: 'coach', label: 'Coaches' },
  { kind: 'athlete', label: 'Athletes' },
]

export default function CoachMessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [myUserId, setMyUserId] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [search, setSearch] = useState('')
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [audience, setAudience] = useState<BroadcastAudience>('everyone')
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastBusy, setBroadcastBusy] = useState(false)
  const [broadcastMsg, setBroadcastMsg] = useState<{ t: string; ok: boolean } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null)
  const [confirmConvo, setConfirmConvo] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [threadKey, setThreadKey] = useState(0)
  const [threadError, setThreadError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setMyUserId(user.id)
      supabase.rpc('is_admin').then(({ data }) => setIsAdmin(data === true))

      const { data: teamId } = await supabase.rpc('get_my_coach_id')
      const coach = teamId ? { id: teamId as string } : null
      if (!coach) { setLoaded(true); return }

      const [{ data: athletes }, { data: contacts }] = await Promise.all([
        supabase
          .from('athletes')
          .select('id, name, sport, user_id')
          .eq('coach_id', coach.id)
          .not('user_id', 'is', null),
        supabase.rpc('message_contacts'),
      ])

      const byId = new Map<string, Omit<Thread, 'lastMessage' | 'lastAt' | 'unread'>>()
      ;(athletes ?? []).forEach(a => {
        byId.set(a.user_id as string, { userId: a.user_id as string, name: a.name, subtitle: a.sport ?? 'Your athlete', kind: 'athlete' })
      })
      ;((contacts ?? []) as { user_id: string; name: string; kind: Kind; detail: string | null }[]).forEach(c => {
        if (byId.has(c.user_id)) return
        byId.set(c.user_id, {
          userId: c.user_id,
          name: c.name,
          subtitle: c.kind === 'admin' ? 'Admin · Support' : c.kind === 'coach' ? (c.detail ?? 'Coach') : c.detail,
          kind: c.kind,
        })
      })
      const people = Array.from(byId.values())

      const ids = people.map(p => p.userId)
      let msgs: Message[] = []
      if (ids.length > 0) {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .or(`sender_id.in.(${ids.join(',')}),receiver_id.in.(${ids.join(',')})`)
          .order('created_at', { ascending: false })
        msgs = (data ?? []) as Message[]
      }

      setThreads(
        people.map(p => {
          const mine = msgs.filter(m => m.sender_id === p.userId || m.receiver_id === p.userId)
          return {
            ...p,
            lastMessage: mine[0]?.content ?? '',
            lastAt: mine[0]?.created_at ?? '',
            unread: mine.filter(m => m.sender_id === p.userId && !m.read).length,
          }
        })
      )
      setLoaded(true)
    })
  }, [reloadKey])

  useEffect(() => {
    if (!selected || !myUserId) return
    const supabase = createClient()
    supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${myUserId},receiver_id.eq.${selected.userId}),and(sender_id.eq.${selected.userId},receiver_id.eq.${myUserId})`)
      .order('created_at')
      .then(({ data }) => {
        setMessages(data ?? [])
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      })

    markMessagesRead(selected.userId)
    setThreads(prev => prev.map(t => (t.userId === selected.userId ? { ...t, unread: 0 } : t)))
  }, [selected, myUserId, threadKey])

  async function deleteOne(id: string) {
    setDeleting(true); setThreadError('')
    const res = await adminDeleteMessage(id)
    setDeleting(false)
    if ('error' in res && res.error) { alertLike(res.error); return }
    setActiveMsgId(null)
    setMessages(prev => {
      const next = prev.filter(m => m.id !== id)
      const last = next[next.length - 1]
      setThreads(ts => ts.map(t => (t.userId === selected?.userId ? { ...t, lastMessage: last?.content ?? '', lastAt: last?.created_at ?? '' } : t)))
      return next
    })
  }

  async function deleteConversation() {
    if (!selected) return
    setDeleting(true)
    const res = await adminDeleteConversation(selected.userId)
    setDeleting(false)
    if ('error' in res && res.error) { alertLike(res.error); return }
    setConfirmConvo(false)
    setMessages([])
    setThreads(ts => ts.map(t => (t.userId === selected.userId ? { ...t, lastMessage: '', lastAt: '', unread: 0 } : t)))
  }

  function alertLike(msg: string) {
    setThreadError(msg)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !selected) return
    setSending(true)
    const content = text.trim()
    await sendMessage(selected.userId, content, '/coach/messages')
    const now = new Date().toISOString()
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        sender_id: myUserId,
        receiver_id: selected.userId,
        content,
        read: false,
        created_at: now,
      },
    ])
    setThreads(prev => prev.map(t => (t.userId === selected.userId ? { ...t, lastMessage: content, lastAt: now } : t)))
    if (isAdmin) setThreadKey(k => k + 1)
    setText('')
    setSending(false)
  }

  async function sendBroadcast() {
    setBroadcastBusy(true); setBroadcastMsg(null)
    const res = await broadcastMessage(audience, broadcastText)
    setBroadcastBusy(false)
    if ('error' in res && res.error) { setBroadcastMsg({ t: res.error, ok: false }); return }
    setBroadcastMsg({ t: `Sent to ${'count' in res ? res.count : 0} people.`, ok: true })
    setBroadcastText('')
    setReloadKey(k => k + 1)
  }

  const q = search.trim().toLowerCase()
  const sorted = (kind: Kind) =>
    threads
      .filter(t => t.kind === kind && (!q || t.name.toLowerCase().includes(q)))
      .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || '') || a.name.localeCompare(b.name))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Messages</h1>
        {isAdmin && (
          <Button size="sm" onClick={() => { setBroadcastMsg(null); setShowBroadcast(true) }}>
            <Megaphone className="w-4 h-4" /> Announcement
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4 h-[calc(100dvh-17rem)] min-h-[360px] md:h-[600px]">
        {/* Thread list */}
        <Card className={cn('overflow-hidden flex-col h-full', selected ? 'hidden md:flex' : 'flex')}>
          {threads.length > 8 && (
            <div className="p-3 border-b border-zinc-800 shrink-0">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search people..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {GROUPS.map(({ kind, label }) => {
              const list = sorted(kind)
              if (list.length === 0) return null
              return (
                <div key={kind}>
                  <p className="sticky top-0 z-10 bg-zinc-900 px-4 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                    {label}
                  </p>
                  <div className="divide-y divide-zinc-800">
                    {list.map(thread => (
                      <button
                        key={thread.userId}
                        onClick={() => setSelected(thread)}
                        className={cn(
                          'w-full text-left px-4 py-3 hover:bg-zinc-800/50 transition-colors',
                          selected?.userId === thread.userId && 'bg-zinc-800/50'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar thread={thread} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{thread.name}</p>
                              <p className="text-xs text-zinc-500 truncate">
                                {thread.lastMessage || (thread.kind === 'admin' ? 'Questions or problems? Message us.' : 'No messages yet')}
                              </p>
                            </div>
                          </div>
                          {thread.unread > 0 && (
                            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                              {thread.unread}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            {loaded && threads.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">No one to message yet.</div>
            )}
          </div>
        </Card>

        {/* Message thread */}
        <Card className={cn('md:col-span-2 flex-col overflow-hidden h-full', selected ? 'flex' : 'hidden md:flex')}>
          {selected ? (
            <>
              <CardHeader className="shrink-0 flex flex-row items-center gap-3">
                <button type="button" onClick={() => setSelected(null)} className="md:hidden -ml-2 p-1 text-zinc-400 hover:text-white" aria-label="Back">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <Avatar thread={selected} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{selected.name}</p>
                  {selected.subtitle && <p className="text-xs text-zinc-500 truncate">{selected.subtitle}</p>}
                </div>
                {isAdmin && messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmConvo(true)}
                    className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Delete conversation"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </CardHeader>
              {isAdmin && messages.length > 0 && (
                <p className="px-5 pt-2 text-[11px] text-zinc-600 shrink-0">Tap a message to delete it.</p>
              )}
              {threadError && <p className="px-5 pt-2 text-xs text-red-400 shrink-0">{threadError}</p>}

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-zinc-500 py-8">
                    {selected.kind === 'admin' ? 'Send a message to the PEAC admin — questions, bugs, or requests.' : 'No messages yet.'}
                  </p>
                )}
                {messages.map(msg => {
                  const isMe = msg.sender_id === myUserId
                  return (
                    <div key={msg.id} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                      <div
                        onClick={isAdmin ? () => setActiveMsgId(id => (id === msg.id ? null : msg.id)) : undefined}
                        className={cn(
                          'max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
                          isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-zinc-800 text-white rounded-bl-sm',
                          isAdmin && 'cursor-pointer',
                          activeMsgId === msg.id && 'ring-2 ring-red-500/60'
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        {msg.attachment_path && <MessageAttachment path={msg.attachment_path} type={msg.attachment_type} title={msg.content} />}
                        <p className={cn('text-[10px] mt-1', isMe ? 'text-blue-200' : 'text-zinc-500')}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {isAdmin && activeMsgId === msg.id && (
                        <button
                          type="button"
                          onClick={() => deleteOne(msg.id)}
                          disabled={deleting}
                          className="mt-1 flex items-center gap-1 rounded-md bg-red-600/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {deleting ? 'Deleting…' : 'Delete message'}
                        </button>
                      )}
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <div className="relative px-4 py-3 border-t border-zinc-800 shrink-0">
                <form onSubmit={handleSend} className="flex gap-2">
                  <VideoSendButton<Message> receiverId={selected.userId} onSent={m => {
                    setMessages(prev => [...prev, m])
                    setThreads(prev => prev.map(t => (t.userId === selected.userId ? { ...t, lastMessage: m.content, lastAt: m.created_at } : t)))
                  }} />
                  <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Write a message..."
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button type="submit" size="sm" loading={sending} disabled={!text.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center text-sm text-zinc-500">
              Select a conversation
            </CardContent>
          )}
        </Card>
      </div>

      <Modal open={confirmConvo} onClose={() => setConfirmConvo(false)} title="Delete conversation?">
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">
            This permanently deletes all {messages.length} messages between you and <b>{selected?.name}</b>, for both of you. This can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmConvo(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={deleteConversation} loading={deleting}>
              <Trash2 className="w-4 h-4" /> Delete conversation
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showBroadcast} onClose={() => setShowBroadcast(false)} title="Send announcement">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {([
              ['coaches', 'All coaches'],
              ['athletes', 'All athletes'],
              ['everyone', 'Everyone'],
            ] as [BroadcastAudience, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setAudience(value)}
                className={cn(
                  'rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors',
                  audience === value ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-zinc-700 text-zinc-400 hover:text-white'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={broadcastText}
            onChange={e => setBroadcastText(e.target.value)}
            rows={5}
            placeholder="Write your announcement..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p className="text-xs text-zinc-500">
            Each person gets it as a private message from you, plus a phone notification if they turned them on. Replies come back to you individually.
          </p>
          {broadcastMsg && <p className={cn('text-sm', broadcastMsg.ok ? 'text-green-400' : 'text-red-400')}>{broadcastMsg.t}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowBroadcast(false)}>Close</Button>
            <Button size="sm" onClick={sendBroadcast} loading={broadcastBusy} disabled={!broadcastText.trim()}>
              <Megaphone className="w-4 h-4" /> Send
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Avatar({ thread }: { thread: Thread }) {
  if (thread.kind === 'admin') {
    return (
      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
        <ShieldCheck className="w-4 h-4" />
      </div>
    )
  }
  return (
    <div
      className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
        thread.kind === 'coach' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-blue-600/20 text-blue-400'
      )}
    >
      {thread.name.slice(0, 2).toUpperCase()}
    </div>
  )
}
