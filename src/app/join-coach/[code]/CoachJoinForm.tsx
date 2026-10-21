'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function CoachJoinForm({ code }: { code: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(e.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: 'coach' } },
    })
    if (error) { setError(error.message); setLoading(false); return }
    if (!data.session) {
      setError('Please confirm your email, then sign in and open this invite link again.')
      setLoading(false)
      return
    }

    const { data: ok, error: claimError } = await supabase.rpc('claim_coach_invite', { code })
    if (claimError || !ok) {
      setError('This invite could not be used. It may have expired — ask for a new one.')
      setLoading(false)
      return
    }
    // Refresh the session so it picks up the coach role
    await supabase.auth.refreshSession()
    router.push('/coach/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Full Name" id="name" name="name" placeholder="Coach Smith" required autoComplete="name" />
      <Input label="Email" id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
      <Input label="Password" id="password" name="password" type="password" placeholder="••••••••" required minLength={6} autoComplete="new-password" />
      {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <Button type="submit" loading={loading} className="w-full" size="lg">Create coach account</Button>
    </form>
  )
}
