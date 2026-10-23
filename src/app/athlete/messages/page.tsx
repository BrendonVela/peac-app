'use client'

import { useEffect, useState, useRef } from 'react'
import { Send, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { sendMessage, markMessagesRead } from '@/app/actions/messages'
import { MessageAttachment } from '@/components/MessageAttachment'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'

interface Contact {
  userId: string
  name: string
  kind: 'coach' | 'admin' | 'staff'
  unread: number
}

export default function AthleteMessagesPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [myUserId, setMyUserId] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setMyUserId(user.id)

      const [{ data: athlete }, { data: extra }, { data: unreadRows }] = await Promise.all([
        supabase.from('athletes').select('id, coach_id, coaches(user_id, name)').eq('user_id', user.id).single(),
        supabase.rpc('message_contacts'),
        supabase.from('messages').select('sender_id').eq('receiver_id', user.id).eq('read', false),
      ])

      const unreadFrom = (id: string) => (unreadRows ?? []).filter((r: { sender_id: string }) => r.sender_id === id).length
      const list: Contact[] = []
      const coach = (athlete as { coaches?: { user_id: string | null; name: string } | null } | null)?.coaches
      if (coach?.user_id) list.push({ userId: coach.user_id, name: coach.name, kind: 'coach', unread: unreadFrom(coach.user_id) })
      ;((extra ?? []) as { user_id: string; name: string; kind: string }[])
        .filter(c => (c.kind === 'admin' || c.kind === 'staff') && !list.some(l => l.userId === c.user_id))
        .forEach(c => list.push({ userId: c.user_id, name: c.name, kind: c.kind as 'admin' | 'staff', unread: unreadFrom(c.user_id) }))

      setContacts(list)
      // Open whichever conversation has something unread, otherwise the coach
      setSelectedId((list.find(c => c.unread > 0) ?? list[0])?.userId ?? null)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!selectedId || !myUserId) return
    const supabase = createClient()
    supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${myUserId},receiver_id.eq.${selectedId}),and(sender_id.eq.${selectedId},receiver_id.eq.${myUserId})`)
      .order('created_at')
      .then(({ data }) => setMessages(data ?? []))
    markMessagesRead(selectedId)
    setContacts(prev => prev.map(c => (c.userId === selectedId ? { ...c, unread: 0 } : c)))
  }, [selectedId, myUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selected = contacts.find(c => c.userId === selectedId) ?? null

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !selected) return
    setSending(true)
    const content = text.trim()
    await sendMessage(selected.userId, content, '/athlete/messages')
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        sender_id: myUserId,
        receiver_id: selected.userId,
        content,
        read: false,
        created_at: new Date().toISOString(),
      },
    ])
    setText('')
    setSending(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Messages</h1>

      {contacts.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {contacts.map(c => (
            <button
              key={c.userId}
              onClick={() => setSelectedId(c.userId)}
              className={cn(
                'flex items-center gap-2 shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                c.userId === selectedId ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-zinc-700 text-zinc-400 hover:text-white'
              )}
            >
              {c.kind === 'admin' ? 'PEAC Admin' : `${c.kind === 'staff' ? 'Asst. ' : ''}Coach ${c.name.split(' ')[0]}`}
              {c.unread > 0 && (
                <span className="bg-blue-600 text-white text-[11px] rounded-full min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center">{c.unread}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <Card className="h-[calc(100dvh-17rem)] min-h-[360px] md:h-[600px] flex flex-col">
        {selected ? (
          <>
            <CardHeader className="shrink-0 flex flex-row items-center gap-3">
              {selected.kind === 'admin' ? (
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-xs font-semibold">
                  {selected.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold">{selected.name}</p>
                <p className="text-xs text-zinc-500">{selected.kind === 'admin' ? 'PEAC Admin' : selected.kind === 'staff' ? 'Assistant coach' : 'Coach'}</p>
              </div>
            </CardHeader>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8 text-sm text-zinc-500">
                  No messages yet. Say hi to your coach!
                </div>
              )}
              {messages.map(msg => {
                const isMe = msg.sender_id === myUserId
                return (
                  <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
                        isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-zinc-800 text-white rounded-bl-sm'
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        {msg.attachment_path && <MessageAttachment path={msg.attachment_path} type={msg.attachment_type} />}
                      <p className={cn('text-[10px] mt-1', isMe ? 'text-blue-200' : 'text-zinc-500')}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <div className="px-4 py-3 border-t border-zinc-800 shrink-0">
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={selected.kind === 'admin' ? 'Reply to PEAC Admin...' : 'Message your coach...'}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button type="submit" size="sm" loading={sending} disabled={!text.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <CardContent className="flex-1 flex items-center justify-center">
            {loaded && (
              <div className="text-center">
                <p className="text-sm text-zinc-400">No coach assigned yet.</p>
                <p className="text-xs text-zinc-500 mt-1">Contact your coach to get connected.</p>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
