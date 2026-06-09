'use client'

import { useEffect, useState, useRef } from 'react'
import { Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { sendMessage, markMessagesRead } from '@/app/actions/messages'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'

export default function AthleteMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [coachUserId, setCoachUserId] = useState<string | null>(null)
  const [coachName, setCoachName] = useState<string>('')
  const [myUserId, setMyUserId] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setMyUserId(user.id)

      const { data: athlete } = await supabase
        .from('athletes')
        .select('id, coach_id, coaches(user_id, name)')
        .eq('user_id', user.id)
        .single()

      if (!athlete?.coach_id) return

      const coach = (athlete as any).coaches
      if (!coach) return
      setCoachUserId(coach.user_id)
      setCoachName(coach.name)

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${coach.user_id}),and(sender_id.eq.${coach.user_id},receiver_id.eq.${user.id})`)
        .order('created_at')

      setMessages(msgs ?? [])
      markMessagesRead(coach.user_id)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !coachUserId) return
    setSending(true)
    await sendMessage(coachUserId, text.trim(), '/athlete/messages')
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        sender_id: myUserId,
        receiver_id: coachUserId,
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

      <Card className="h-[600px] flex flex-col">
        {coachUserId ? (
          <>
            <CardHeader className="shrink-0 flex flex-row items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-xs font-semibold">
                {coachName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">{coachName}</p>
                <p className="text-xs text-zinc-500">Coach</p>
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
                  placeholder="Message your coach..."
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
            <div className="text-center">
              <p className="text-sm text-zinc-400">No coach assigned yet.</p>
              <p className="text-xs text-zinc-500 mt-1">Contact your coach to get connected.</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
