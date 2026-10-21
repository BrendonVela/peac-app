'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Share, PlusSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { savePushSubscription, removePushSubscription, sendTestPush } from '@/app/actions/push'

type State = 'loading' | 'unsupported' | 'ios-install' | 'blocked' | 'off' | 'on' | 'no-key'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
}

export function NotificationSettings({ role }: { role: 'coach' | 'athlete' }) {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)

  useEffect(() => {
    (async () => {
      if (!VAPID_PUBLIC_KEY) return setState('no-key')
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
      if (!supported) return setState(isIos() && !isStandalone() ? 'ios-install' : 'unsupported')
      if (Notification.permission === 'denied') return setState('blocked')
      const reg = await navigator.serviceWorker.getRegistration('/')
      const sub = await reg?.pushManager.getSubscription()
      setState(sub ? 'on' : 'off')
    })().catch(() => setState('unsupported'))
  }, [])

  async function enable() {
    setBusy(true); setMsg(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState(permission === 'denied' ? 'blocked' : 'off'); return }
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      const res = await savePushSubscription({
        endpoint: json.endpoint ?? sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
      })
      if ('error' in res && res.error) { setMsg({ t: res.error, ok: false }); return }
      setState('on')
      const test = await sendTestPush()
      setMsg('error' in test && test.error ? { t: test.error, ok: false } : { t: 'Turned on — you should get a test notification.', ok: true })
    } catch (e) {
      setMsg({ t: (e as Error).message || 'Could not turn on notifications.', ok: false })
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true); setMsg(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setState('off')
      setMsg({ t: 'Notifications turned off on this device.', ok: true })
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true); setMsg(null)
    const res = await sendTestPush()
    setBusy(false)
    setMsg('error' in res && res.error ? { t: res.error, ok: false } : { t: 'Test sent.', ok: true })
  }

  const what = role === 'athlete'
    ? 'Get a reminder on days you have a workout, and an alert when your coach messages you.'
    : 'Get an alert when one of your athletes messages you.'

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="w-4 h-4 text-blue-400" /> Notifications</CardTitle></CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-sm text-zinc-400">{what}</p>

        {state === 'loading' && <p className="text-sm text-zinc-500">Checking…</p>}

        {state === 'no-key' && (
          <p className="text-sm text-zinc-500">Notifications are coming soon.</p>
        )}

        {state === 'unsupported' && (
          <p className="text-sm text-zinc-500">This browser doesn&apos;t support notifications. Try Chrome, Edge or Safari, or add PEAC to your home screen.</p>
        )}

        {state === 'ios-install' && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3 text-sm text-zinc-300 space-y-2">
            <p className="font-medium text-white">On iPhone, add PEAC to your Home Screen first:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>In Safari, tap <Share className="inline w-4 h-4 -mt-0.5" /> <b>Share</b>.</li>
              <li>Tap <PlusSquare className="inline w-4 h-4 -mt-0.5" /> <b>Add to Home Screen</b>.</li>
              <li>Open PEAC from your Home Screen and come back to Settings.</li>
            </ol>
          </div>
        )}

        {state === 'blocked' && (
          <p className="text-sm text-amber-400">Notifications are blocked for PEAC. Turn them on in your phone or browser settings, then reload this page.</p>
        )}

        {state === 'off' && (
          <Button size="sm" onClick={enable} loading={busy}><Bell className="w-4 h-4" /> Turn on notifications</Button>
        )}

        {state === 'on' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-green-400 mr-1">On for this device</span>
            <Button size="sm" variant="secondary" onClick={test} loading={busy}>Send test</Button>
            <Button size="sm" variant="ghost" onClick={disable} disabled={busy}><BellOff className="w-4 h-4" /> Turn off</Button>
          </div>
        )}

        {msg && <p className={`text-xs ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.t}</p>}
      </CardContent>
    </Card>
  )
}
