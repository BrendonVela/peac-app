'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { PeacLogo } from '@/components/brand/PeacLogo'
import { VideoBackground } from '@/components/brand/VideoBackground'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deletedNotice, setDeletedNotice] = useState(false)
  useEffect(() => { setDeletedNotice(!!new URLSearchParams(window.location.search).get('deleted')) }, [])
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const email = form.get('email') as string
    const password = form.get('password') as string

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Return to an invite link (or other page) if one was given
    const next = new URL(window.location.href).searchParams.get('next')
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      router.push(next)
      router.refresh()
      return
    }

    const role = data.user?.user_metadata?.role
    if (role === 'coach') router.push('/coach/dashboard')
    else if (role === 'athlete') router.push('/athlete/dashboard')
    else router.push('/')
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
