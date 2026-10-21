'use client'

import { useEffect, useState } from 'react'
import { Link2, Copy, Check, RefreshCw, Share2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { getOrCreateJoinCode, regenerateJoinCode } from '@/app/actions/invites'

export function InviteCard() {
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
    getOrCreateJoinCode().then(res => {
      if (res && 'code' in res && res.code) setCode(res.code)
      else if (res && 'error' in res && res.error) setError(res.error)
    })
  }, [])

  const link = code && typeof window !== 'undefined' ? `${window.location.origin}/join/${code}` : ''

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy — select the link and copy it manually.')
    }
  }

  async function share() {
    if (!link) return
    try {
      await navigator.share({ title: 'Join my team on PEAC', text: 'Sign up here to get your workouts:', url: link })
    } catch { /* user closed the share sheet */ }
  }

  async function regenerate() {
    if (!confirm('Make a new link? The old link will stop working for anyone who hasn’t signed up yet.')) return
    setBusy(true)
    const res = await regenerateJoinCode()
    setBusy(false)
    if (res && 'code' in res && res.code) setCode(res.code)
    else if (res && 'error' in res && res.error) setError(res.error)
  }

  return (
    <Card className="border-blue-600/30">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-600/10 rounded-lg shrink-0">
            <Link2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Invite athletes</p>
            <p className="text-xs text-zinc-400">
              Send this link to your athletes. When they sign up with it, they&apos;re added to your roster automatically.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            readOnly
            value={link || (error ? '' : 'Loading…')}
            onFocus={e => e.currentTarget.select()}
            className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={copy}
              disabled={!link}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {canShare && (
              <button
                onClick={share}
                disabled={!link}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 hover:text-white disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            )}
            <button
              onClick={regenerate}
              disabled={busy || !code}
              title="Make a new link"
              className="flex items-center justify-center px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </CardContent>
    </Card>
  )
}
