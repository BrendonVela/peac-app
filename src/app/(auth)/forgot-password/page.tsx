'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Zap, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim()

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)

    // Too many requests is the only error worth showing; otherwise don't reveal whether the email exists
    if (error && /rate|too many|seconds/i.test(error.message)) {
      setError('Too many requests. Please wait a minute and try again.')
      return
    }
    setSent(true)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <Zap className="w-8 h-8 text-blue-500 fill-blue-500" />
          <span className="text-2xl font-bold tracking-tight">PEAC</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          {sent ? (
            <div className="text-center space-y-3">
              <MailCheck className="w-10 h-10 text-blue-400 mx-auto" />
              <h1 className="text-xl font-semibold">Check your email</h1>
              <p className="text-sm text-zinc-400">
                If an account exists for that email, we sent a link to reset your password.
                It can take a minute or two — check your spam folder too.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold mb-1">Forgot password?</h1>
              <p className="text-sm text-zinc-400 mb-6">Enter your email and we&apos;ll send you a reset link.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Email" id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                )}
                <Button type="submit" loading={loading} className="w-full" size="lg">Send reset link</Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-zinc-500 mt-6">
          <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
