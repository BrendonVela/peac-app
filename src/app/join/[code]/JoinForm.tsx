'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function JoinForm({ code }: { code: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkEmail, setCheckEmail] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(e.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    const supabase = createClient()
    // The database adds the athlete to the coach's roster from join_code
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: 'athlete', join_code: code },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    setLoading(false)

    if (error) { setError(error.message); return }
    if (!data.session) { setCheckEmail(true); return }
    router.push('/athlete/dashboard')
    router.refresh()
  }

  if (checkEmail) {
    return (
      <div className="text-center space-y-3">
        <MailCheck className="w-10 h-10 text-blue-400 mx-auto" />
        <h2 className="text-lg font-semibold">Confirm your email</h2>
        <p className="text-sm text-zinc-400">
          We sent you a link. Tap it to confirm your account, then sign in — you&apos;ll already be on the team.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Full Name" id="name" name="name" placeholder="John Smith" required autoComplete="name" />
      <Input label="Email" id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
      <Input label="Password" id="password" name="password" type="password" placeholder="••••••••" required minLength={6} autoComplete="new-password" />
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}
      <Button type="submit" loading={loading} className="w-full" size="lg">Create account &amp; join</Button>
    </form>
  )
}
