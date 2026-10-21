'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

type Stage = 'checking' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('checking')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Turn the link from the email into a signed-in session
  useEffect(() => {
    const supabase = createClient()
    const url = new URL(window.location.href)
    const tokenHash = url.searchParams.get('token_hash')
    const code = url.searchParams.get('code')

    async function verify() {
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        setStage(error ? 'invalid' : 'ready')
        return
      }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) { setStage('ready'); return }
      }
      // Older links put the session in the # part of the URL; the client picks it up automatically
      await new Promise(r => setTimeout(r, 400))
      const { data } = await supabase.auth.getSession()
      setStage(data.session ? 'ready' : 'invalid')
    }
    verify()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const password = String(form.get('password') ?? '')
    const confirm = String(form.get('confirm') ?? '')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords don’t match.'); return }

    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }

    const role = data.user?.user_metadata?.role
    router.push(role === 'coach' ? '/coach/dashboard' : role === 'athlete' ? '/athlete/dashboard' : '/')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <Zap className="w-8 h-8 text-blue-500 fill-blue-500" />
          <span className="text-2xl font-bold tracking-tight">PEAC</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          {stage === 'checking' && <p className="text-sm text-zinc-400 text-center">Checking your link…</p>}

          {stage === 'invalid' && (
            <div className="text-center space-y-3">
              <h1 className="text-xl font-semibold">Link expired</h1>
              <p className="text-sm text-zinc-400">
                This reset link is invalid or has already been used. Request a new one.
              </p>
              <Link href="/forgot-password">
                <Button className="w-full mt-2">Send a new link</Button>
              </Link>
            </div>
          )}

          {stage === 'ready' && (
            <>
              <h1 className="text-xl font-semibold mb-1">Set a new password</h1>
              <p className="text-sm text-zinc-400 mb-6">Choose a password you&apos;ll remember.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="New password" id="password" name="password" type="password" placeholder="••••••••" required minLength={6} autoComplete="new-password" />
                <Input label="Confirm password" id="confirm" name="confirm" type="password" placeholder="••••••••" required minLength={6} autoComplete="new-password" />
                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                )}
                <Button type="submit" loading={loading} className="w-full" size="lg">Save password</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
