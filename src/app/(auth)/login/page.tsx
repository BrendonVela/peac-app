'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { PeacLogo } from '@/components/brand/PeacLogo'
import { VideoBackground } from '@/components/brand/VideoBackground'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [deletedNotice, setDeletedNotice] = useState(false)
  useEffect(() => { setDeletedNotice(!!new URLSearchParams(window.location.search).get('deleted')) }, [])
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    // Phones often add a space or a capital letter to emails: clean that up
    const email = String(form.get('email') ?? '').trim().toLowerCase()
    const password = String(form.get('password') ?? '')

    const supabase = createClient()
    let result = await supabase.auth.signInWithPassword({ email, password })
    // A dropped connection (bad gym wifi) shows up as a network error: try once more
    if (result.error && /fetch|network|timeout|load failed/i.test(result.error.message)) {
      await new Promise(r => setTimeout(r, 800))
      result = await supabase.auth.signInWithPassword({ email, password })
    }
    const { data, error } = result

    if (error) {
      setError(
        /invalid login credentials/i.test(error.message)
          ? "That email and password don't match. Check for typos, or tap the eye to see your password."
          : /email not confirmed/i.test(error.message)
            ? 'Please confirm your email first. Check your inbox for the link.'
            : /rate limit|too many/i.test(error.message)
              ? 'Too many tries. Wait a minute, then try again.'
              : /fetch|network|timeout|load failed/i.test(error.message)
                ? "Couldn't reach PEAC. Check your connection and try again."
                : error.message
      )
      setLoading(false)
      return
    }

    // Full page load (not an in-app jump) so the new login is always picked up
    const next = new URL(window.location.href).searchParams.get('next')
    const role = data.user?.user_metadata?.role
    const dest = next && next.startsWith('/') && !next.startsWith('//')
      ? next
      : role === 'coach' ? '/coach/dashboard' : role === 'athlete' ? '/athlete/dashboard' : '/'
    window.location.assign(dest)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink">
      <VideoBackground clip="login" overlay="bottom" />
      <div className="relative min-h-screen flex flex-col items-center px-5 pt-[max(4rem,env(safe-area-inset-top))] pb-10">
        {/* Big centered logo */}
        <div className="flex flex-col items-center text-center mt-[6vh]">
          <PeacLogo size="xl" stacked />
          <p className="mt-5 font-display italic font-extrabold uppercase text-3xl leading-none tracking-wide">
            Train with <span className="text-blue-400">purpose.</span>
          </p>
          <p className="mt-3 text-sm text-zinc-300 max-w-xs">Your program, your coach and your progress in one place.</p>
        </div>

        <div className="w-full max-w-sm mt-auto pt-10">
          <div className="bg-panel/80 backdrop-blur-md border border-line rounded-3xl p-6">
            <h1 className="sr-only">Sign in</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                id="email"
                name="email"
                type="email"
                placeholder="you@school.edu"
                required
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <Input
                label="Password"
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <div className="flex justify-end -mt-2">
                <Link href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300">
                  Forgot password?
                </Link>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" loading={loading} className="w-full" size="lg">
                Log in
              </Button>
            </form>
          </div>

          {deletedNotice && (
            <p className="text-center text-sm text-green-400 mt-4">Your account has been deleted.</p>
          )}
          <p className="text-center text-sm text-zinc-300 mt-6">
            New here?{' '}
            <Link href="/register" className="text-blue-400 hover:text-blue-300 font-semibold">
              Join with your team code
            </Link>
          </p>
          <p className="text-center text-xs text-zinc-500 mt-4">
            <Link href="/terms" className="hover:text-zinc-300">Terms</Link>
            <span className="mx-2">·</span>
            <Link href="/privacy" className="hover:text-zinc-300">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
