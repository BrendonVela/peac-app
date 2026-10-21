'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState<'coach' | 'athlete'>('athlete')
const [inviteCode, setInviteCode] = useState('')
  const [checkEmail, setCheckEmail] = useState(false)
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const email = form.get('email') as string
    const password = form.get('password') as string
    const name = form.get('name') as string

    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Registration failed. Please try again.')
      setLoading(false)
      return
    }

   if (role === 'coach') {
  const { error: claimError } = await supabase.rpc('claim_coach_role', {
    invite_code: inviteCode,
  })
  if (claimError) {
    setError('Invalid coach invite code.')
    setLoading(false)
    return
  }
  router.push('/coach/dashboard')
} else {
      // The athlete row is created by the database when the account is made
      if (!data.session) {
        setError('')
        setLoading(false)
        setCheckEmail(true)
        return
      }
      router.push('/athlete/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <Zap className="w-8 h-8 text-blue-500 fill-blue-500" />
          <span className="text-2xl font-bold tracking-tight">PEAC</span>
        </div>

        {checkEmail ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-3">
            <h1 className="text-xl font-semibold">Confirm your email</h1>
            <p className="text-sm text-zinc-400">We sent you a link. Tap it to confirm your account, then sign in.</p>
            <Link href="/login" className="inline-block text-sm text-blue-400 hover:text-blue-300">Go to sign in</Link>
          </div>
        ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <h1 className="text-xl font-semibold mb-1">Create account</h1>
          <p className="text-sm text-zinc-400 mb-6">Get started with PEAC</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role selector */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">I am a</p>
              <div className="grid grid-cols-2 gap-2">
                {(['athlete', 'coach'] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      'py-2.5 rounded-lg text-sm font-medium border transition-all capitalize',
                      role === r
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600'
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
{role === 'coach' && (
  <Input
    label="Coach Invite Code"
    id="inviteCode"
    name="inviteCode"
    type="text"
    placeholder="Enter your invite code"
    required
    value={inviteCode}
    onChange={(e) => setInviteCode(e.target.value)}
  />
)}
            <Input label="Full Name" id="name" name="name" type="text" placeholder="John Smith" required />
            <Input label="Email" id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
            <Input label="Password" id="password" name="password" type="password" placeholder="••••••••" required minLength={6} autoComplete="new-password" />

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Create Account
            </Button>
          </form>
        </div>
        )}

        <p className="text-center text-sm text-zinc-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
