'use client'

import { useEffect, useState } from 'react'
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
  const [athleteCode, setAthleteCode] = useState('')
  const [coachName, setCoachName] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)

  // Allow links like /register?code=ABC123
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('code')
    if (c) setAthleteCode(c.toUpperCase())
  }, [])

  // Show which coach the athlete code belongs to
  useEffect(() => {
    const c = athleteCode.trim()
    if (c.length < 4) { setCoachName(null); return }
    const t = setTimeout(async () => {
      const { data } = await createClient().rpc('coach_name_for_code', { code: c })
      setCoachName((data as string | null) ?? null)
    }, 350)
    return () => clearTimeout(t)
  }, [athleteCode])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const email = form.get('email') as string
    const password = form.get('password') as string
    const name = form.get('name') as string

    const supabase = createClient()

    // Check the code BEFORE making the account
    if (role === 'athlete') {
      const { data: found } = await supabase.rpc('coach_name_for_code', { code: athleteCode.trim() })
      if (!found) {
        setError('That coach code isn\u2019t right. Ask your coach for their code or sign-up link.')
        setLoading(false)
        return
      }
    } else {
      const { data: ok } = await supabase.rpc('coach_signup_code_valid', { code: inviteCode.trim() })
      if (!ok) {
        setError('That coach sign-up code isn\u2019t right.')
        setLoading(false)
        return
      }
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: role === 'athlete'
          ? { name, role, join_code: athleteCode.trim().toUpperCase() }
          : { name, role },
      },
    })

    if (signUpError) {
      setError(/database error/i.test(signUpError.message)
        ? 'Could not create the account. Check your coach code and try again.'
        : signUpError.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Registration failed. Please try again.')
      setLoading(false)
      return
    }

    if (role === 'coach') {
      // One-time coach invites first, then the shared coach code
      const { data: claimedInvite } = await supabase.rpc('claim_coach_invite', { code: inviteCode })
      const { error: claimError } = claimedInvite
        ? { error: null }
        : await supabase.rpc('claim_coach_role', { invite_code: inviteCode })
      if (claimError) {
        setError('Invalid coach invite code.')
        setLoading(false)
        return
      }
      await supabase.auth.refreshSession()
      router.push('/coach/dashboard')
    } else {
      if (!data.session) {
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
            {role === 'coach' ? (
              <Input
                label="Coach sign-up code"
                id="inviteCode"
                name="inviteCode"
                type="text"
                placeholder="Code from PEAC"
                required
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
              />
            ) : (
              <div className="space-y-1.5">
                <Input
                  label="Your coach's code"
                  id="athleteCode"
                  name="athleteCode"
                  type="text"
                  placeholder="Ask your coach for it"
                  required
                  autoCapitalize="characters"
                  value={athleteCode}
                  onChange={e => setAthleteCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                />
                {athleteCode.trim().length >= 4 && (
                  <p className={cn('text-xs', coachName ? 'text-green-400' : 'text-zinc-500')}>
                    {coachName ? `You\u2019ll join Coach ${coachName}` : 'No coach found with that code yet'}
                  </p>
                )}
              </div>
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
        <p className="text-center text-xs text-zinc-600 mt-4">
          By creating an account you agree to our <Link href="/terms" className="underline hover:text-zinc-400">Terms of Service</Link> and <Link href="/privacy" className="underline hover:text-zinc-400">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  )
}
