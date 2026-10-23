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
    if (!admin) console.log('[push] message: no admin client (SUPABASE_SERVICE_ROLE_KEY missing)')
    if (admin) {
      const [{ data: senderCoach }, { data: senderAthlete }, { data: receiverAthlete }] = await Promise.all([
        admin.from('coaches').select('name, is_admin').eq('user_id', user.id).maybeSingle(),
        admin.from('athletes').select('name').eq('user_id', user.id).maybeSingle(),
        admin.from('athletes').select('id').eq('user_id', receiverId).maybeSingle(),
      ])
      const senderName = senderCoach?.name ?? senderAthlete?.name ?? 'PEAC'
      const text = content.trim()
      const sent = await sendPushToUsers([receiverId], {
        title: senderCoach?.is_admin ? `PEAC Admin · ${senderName}` : senderCoach ? `Coach ${senderName}` : senderName,
        body: text.length > 140 ? text.slice(0, 137) + '…' : text,
        url: receiverAthlete ? '/athlete/messages' : '/coach/messages',
      })
      console.log('[push] message', { from: user.id, to: receiverId, sent })
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

export type BroadcastAudience = 'coaches' | 'athletes' | 'everyone'

/** Admin only: send the same message to all coaches, all athletes, or everyone (each gets it in their own thread) */
export async function broadcastMessage(audience: BroadcastAudience, content: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'Only the admin can send announcements.' }

  const text = content.trim()
  if (!text) return { error: 'Write a message first.' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' }

  const ids = new Set<string>()
  if (audience === 'coaches' || audience === 'everyone') {
    const { data } = await admin.from('coaches').select('user_id').not('user_id', 'is', null)
    ;(data ?? []).forEach((r: { user_id: string | null }) => r.user_id && ids.add(r.user_id))
  }
  if (audience === 'athletes' || audience === 'everyone') {
    const { data } = await admin.from('athletes').select('user_id').not('user_id', 'is', null)
    ;(data ?? []).forEach((r: { user_id: string | null }) => r.user_id && ids.add(r.user_id))
  }
  ids.delete(user.id)
  const recipients = Array.from(ids)
  if (recipients.length === 0) return { error: 'No one to send to yet.' }

  const { error } = await supabase.from('messages').insert(
    recipients.map(rid => ({ sender_id: user.id, receiver_id: rid, content: text }))
  )
  if (error) return { error: error.message }

  // Work out who is an athlete so their notification opens the right page
  const { data: athleteRows } = await admin.from('athletes').select('user_id').in('user_id', recipients)
  const athleteIds = new Set((athleteRows ?? []).map((r: { user_id: string }) => r.user_id))
  const body = text.length > 140 ? text.slice(0, 137) + '…' : text
  const coachIds = recipients.filter(r => !athleteIds.has(r))
  const athleteList = recipients.filter(r => athleteIds.has(r))
  await Promise.all([
    sendPushToUsers(coachIds, { title: 'PEAC Announcement', body, url: '/coach/messages' }),
    sendPushToUsers(athleteList, { title: 'PEAC Announcement', body, url: '/athlete/messages' }),
  ])

  revalidatePath('/coach/messages')
  return { ok: true, count: recipients.length }
}

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' as const }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'Only the admin can delete messages.' as const }
  const admin = createAdminClient()
  if (!admin) return { error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' as const }
  return { user, admin }
}

/** Admin only: delete one message */
export async function adminDeleteMessage(messageId: string) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { data: row } = await ctx.admin.from('messages').select('attachment_path').eq('id', messageId).maybeSingle()
  const { error } = await ctx.admin.from('messages').delete().eq('id', messageId)
  if (!error && row?.attachment_path) {
    await ctx.admin.storage.from('form-videos').remove([row.attachment_path])
    await ctx.admin.from('video_analyses').delete().eq('video_path', row.attachment_path)
  }
  if (error) return { error: error.message }
  revalidatePath('/coach/messages')
  return { ok: true }
}

/** Admin only: delete every message between two people (defaults to the admin and `otherUserId`) */
export async function adminDeleteConversation(otherUserId: string, firstUserId?: string) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const a = firstUserId ?? ctx.user.id
  const b = otherUserId
  const pair = `and(sender_id.eq.${a},receiver_id.eq.${b}),and(sender_id.eq.${b},receiver_id.eq.${a})`
  const { data: files } = await ctx.admin.from('messages').select('attachment_path').or(pair).not('attachment_path', 'is', null)
  const paths = (files ?? []).map((f: { attachment_path: string }) => f.attachment_path)
  if (paths.length) {
    await ctx.admin.storage.from('form-videos').remove(paths)
    await ctx.admin.from('video_analyses').delete().in('video_path', paths)
  }
  const { error } = await ctx.admin
    .from('messages')
    .delete()
    .or(`and(sender_id.eq.${a},receiver_id.eq.${b}),and(sender_id.eq.${b},receiver_id.eq.${a})`)
  if (error) return { error: error.message }
  revalidatePath('/coach/messages')
  return { ok: true }
}

/** Athlete sends an uploaded form-check video to their coach */
export async function sendFormVideo(path: string, type: string, exerciseTitle: string, note: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!path.startsWith(`${user.id}/`)) return { error: 'Invalid upload' }

  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, name, coaches(user_id)')
    .eq('user_id', user.id)
    .maybeSingle()
  const coachUserId = (athlete as { coaches?: { user_id: string | null } | null } | null)?.coaches?.user_id
  if (!coachUserId) return { error: 'You need a coach before you can send videos.' }

  const content = `🎥 Form check — ${exerciseTitle}${note.trim() ? `\n${note.trim()}` : ''}`
  const { error } = await supabase.from('messages').insert({
    sender_id: user.id,
    receiver_id: coachUserId,
    content,
    attachment_path: path,
    attachment_type: type,
  })
  if (error) return { error: error.message }

  await sendPushToUsers([coachUserId], {
    title: `${athlete?.name ?? 'Athlete'} sent a form check`,
    body: exerciseTitle,
    url: '/coach/messages',
  })
  revalidatePath('/coach/messages')
  revalidatePath('/athlete/messages')
  return { ok: true }
}
