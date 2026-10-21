import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

let configured = false
function configure(): boolean {
  if (configured) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:bjvpeac@gmail.com', pub, priv)
  configured = true
  return true
}

export function pushIsConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/** Send a notification to every device these users turned notifications on for. Never throws. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  try {
    if (userIds.length === 0 || !configure()) return 0
    const admin = createAdminClient()
    if (!admin) return 0

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', userIds)
    if (!subs || subs.length === 0) return 0

    const body = JSON.stringify(payload)
    const dead: string[] = []
    let sent = 0

    await Promise.all(
      subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: 60 * 60 * 12, urgency: 'normal' }
          )
          sent++
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode
          // 404/410 = this phone turned notifications off or the app was removed
          if (code === 404 || code === 410) dead.push(s.id)
          else console.error('push failed', code, (err as Error).message)
        }
      })
    )

    if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead)
    return sent
  } catch (err) {
    console.error('sendPushToUsers error', err)
    return 0
  }
}
