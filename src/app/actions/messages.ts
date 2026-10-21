'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendPushToUsers } from '@/lib/push'
import { createAdminClient } from '@/lib/supabase/admin'

export async function sendMessage(receiverId: string, content: string, returnPath: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('messages').insert({
    sender_id: user.id,
    receiver_id: receiverId,
    content: content.trim(),
  })

  if (error) return { error: error.message }

  // Phone notification for the person receiving the message
  try {
    const admin = createAdminClient()
    if (admin) {
      const [{ data: senderCoach }, { data: senderAthlete }, { data: receiverAthlete }] = await Promise.all([
        admin.from('coaches').select('name').eq('user_id', user.id).maybeSingle(),
        admin.from('athletes').select('name').eq('user_id', user.id).maybeSingle(),
        admin.from('athletes').select('id').eq('user_id', receiverId).maybeSingle(),
      ])
      const senderName = senderCoach?.name ?? senderAthlete?.name ?? 'PEAC'
      const text = content.trim()
      await sendPushToUsers([receiverId], {
        title: senderCoach ? `Coach ${senderName}` : senderName,
        body: text.length > 140 ? text.slice(0, 137) + '…' : text,
        url: receiverAthlete ? '/athlete/messages' : '/coach/messages',
        tag: `msg-${user.id}`,
      })
    }
  } catch (e) {
    console.error('message push failed', e)
  }

  revalidatePath(returnPath)
}

export async function markMessagesRead(senderId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('messages')
    .update({ read: true })
    .eq('sender_id', senderId)
    .eq('receiver_id', user.id)
    .eq('read', false)
}
