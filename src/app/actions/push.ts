'use server'

import { createClient } from '@/lib/supabase/server'
import { sendPushToUsers, pushIsConfigured } from '@/lib/push'

export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.p256dh,
    p_auth: sub.auth,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function removePushSubscription(endpoint: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)
  return { ok: true }
}

export async function sendTestPush() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!pushIsConfigured()) return { error: 'Notifications are not set up on the server yet.' }
  const sent = await sendPushToUsers([user.id], {
    title: 'PEAC notifications are on 💪',
    body: 'You will get workout reminders and new messages here.',
    url: user.user_metadata?.role === 'coach' ? '/coach/dashboard' : '/athlete/dashboard',
    tag: 'test',
  })
  return sent > 0 ? { ok: true } : { error: 'Could not reach this device. Try turning notifications off and on again.' }
}
