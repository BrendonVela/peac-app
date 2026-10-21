import Link from 'next/link'
import { Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CoachJoinForm } from './CoachJoinForm'

export default async function JoinCoachPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code).trim().toUpperCase()
  const supabase = createClient()
  const [{ data: valid }, { data: { user } }] = await Promise.all([
    supabase.rpc('coach_invite_valid', { code }),
    supabase.auth.getUser(),
  ])

  let content: React.ReactNode
  if (!valid) {
    content = (
      <div className="text-center space-y-3">
        <h1 className="text-xl font-semibold">Invite not valid</h1>
        <p className="text-sm text-zinc-400">This coach invite has already been used or has expired. Ask for a new one.</p>
      </div>
    )
  } else if (user) {
    content = (
      <div className="text-center space-y-3">
        <h1 className="text-xl font-semibold">You&apos;re signed in</h1>
        <p className="text-sm text-zinc-400">
          Coach invites are for new accounts. Sign out first, then open this link again to create your coach account.
        </p>
        <Link href={user.user_metadata?.role === 'coach' ? '/coach/dashboard' : '/athlete/dashboard'} className="inline-block text-sm text-blue-400 hover:text-blue-300">
          Go to dashboard
        </Link>
      </div>
    )
  } else {
    content = (
      <>
        <h1 className="text-xl font-semibold mb-1">Create your coach account</h1>
        <p className="text-sm text-zinc-400 mb-6">You&apos;ve been invited to coach on PEAC.</p>
        <CoachJoinForm code={code} />
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <Zap className="w-8 h-8 text-blue-500 fill-blue-500" />
          <span className="text-2xl font-bold tracking-tight">PEAC</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">{content}</div>
        <p className="text-center text-xs text-zinc-600 mt-4">
          By creating an account you agree to our <Link href="/terms" className="underline hover:text-zinc-400">Terms of Service</Link> and <Link href="/privacy" className="underline hover:text-zinc-400">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  )
}
