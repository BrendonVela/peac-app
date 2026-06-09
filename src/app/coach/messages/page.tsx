'use client'

import { useEffect, useState, useRef } from 'react'
import { Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { sendMessage, markMessagesRead } from '@/app/actions/messages'
import { cn, formatDate } from '@/lib/utils'
import type { Athlete, Message } from '@/types'

interface Thread {
  athlete: Athlete & { user_id: string }
  lastMessage: string
  unread: number
}

export default function CoachMessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [selected, setSelected] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [myUserId, setMyUserId] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setMyUserId(user.id)

      const { data: coach } = await supabase.from('coaches').select('id').eq('user_id', user.id).single()
      if (!coach) return

      const { data: athletes } = await supabase
        .from('athletes')
        .select('id, name, sport, user_id, coach_id, position, graduation_year, created_at')
        .eq('coach_id', coach.id)
        .not('user_id', 'is', null)

      if (!athletes) return

      const athleteUserIds = athletes.filter(a => a.user_id).map(a => a.user_id as string)

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.in.(${athleteUserIds.join(',')}),receiver_id.in.(${athleteUserIds.join(',')})`)
        .order('created_at', { ascending: false })

      const threadMap = athletes
        .filter(a => a.user_id)
        .map(athlete => {
          const athleteMsgs = (msgs ?? []).filter(
            m => m.sender_id === athlete.user_id || m.receiver_id === athlete.user_id
          )
          const unread = athleteMsgs.filter(m => m.sender_id === athlete.user_id && !m.read).length
          return {
            athlete: athlete as Thread['athlete'],
            lastMessage: athleteMsgs[0]?.content ?? '',
            unread,
          }
        })

      setThreads(threadMap)
    })
  }, [])

  useEffect(() => {
    if (!selected || !myUserId) return
    const supabase = createClient()
    supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${myUserId},receiver_id.eq.${selected.athlete.user_id}),and(sender_id.eq.${selected.athlete.user_id},receiver_id.eq.${myUserId})`)
      .order('created_at')
      .then(({ data }) => {
        setMessages(data ?? [])
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      })

    markMessagesRead(selected.athlete.user_id!)
  }, [selected, myUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !selected?.athlete.user_id) return
    setSending(true)
    await sendMessage(selected.athlete.user_id!, text.trim(), '/coach/messages')
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        sender_id: myUserId,
        receiver_id: selected.athlete.user_id!,
        content: text.trim(),
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

      <div className="grid md:grid-cols-3 gap-4 h-[600px]">
        {/* Thread list */}
        <Card className="overflow-hidden flex flex-col">
          <CardHeader className="shrink-0">
            <p className="text-sm font-semibold">Athletes</p>
          </CardHeader>
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800">
            {threads.map(thread => (
              <button
                key={thread.athlete.id}
                onClick={() => setSelected(thread)}
                className={cn(
                  'w-full text-left px-4 py-3 hover:bg-zinc-800/50 transition-colors',
                  selected?.athlete.id === thread.athlete.id && 'bg-zinc-800/50'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-xs font-semibold shrink-0">
                      {thread.athlete.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{thread.athlete.name}</p>
                      <p className="text-xs text-zinc-500 truncate">{thread.lastMessage || 'No messages yet'}</p>
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
            {threads.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">
                No athletes with accounts yet.
              </div>
            )}
          </div>
        </Card>

        {/* Message thread */}
        <Card className="md:col-span-2 flex flex-col overflow-hidden">
          {selected ? (
            <>
              <CardHeader className="shrink-0 flex flex-row items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-xs font-semibold">
                  {selected.athlete.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{selected.athlete.name}</p>
                  {selected.athlete.sport && <p className="text-xs text-zinc-500">{selected.athlete.sport}</p>}
                </div>
              </CardHeader>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.map(msg => {
                  const isMe = msg.sender_id === myUserId
                  return (
                    <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
                          isMe
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-zinc-800 text-white rounded-bl-sm'
                        )}
                      >
                        <p>{msg.content}</p>
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
              Select an athlete to start messaging
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
