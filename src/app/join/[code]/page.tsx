import Link from 'next/link'
import { Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { JoinForm } from './JoinForm'
import { JoinButton } from './JoinButton'

export default async function JoinPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code).trim().toUpperCase()
  const supabase = createClient()

  const [{ data: coachName }, { data: { user } }] = await Promise.all([
    supabase.rpc('coach_name_for_code', { code }),
    supabase.auth.getUser(),
  ])

  let content: React.ReactNode

  if (!coachName) {
    content = (
      <div className="text-center space-y-3">
        <h1 className="text-xl font-semibold">Invite link not found</h1>
        <p className="text-sm text-zinc-400">This link may have been replaced. Ask your coach for a new one.</p>
      </div>
    )
  } else if (user?.user_metadata?.role === 'coach') {
    content = (
      <div className="text-center space-y-3">
        <h1 className="text-xl font-semibold">This is an athlete invite link</h1>
        <p className="text-sm text-zinc-400">Share it with your athletes so they join your roster when they sign up.</p>
        <Link href="/coach/athletes" className="inline-block text-sm text-blue-400 hover:text-blue-300">Back to Athletes</Link>
      </div>
    )
  } else if (user) {
    const { data: athlete } = await supabase.from('athletes').select('coach_id').eq('user_id', user.id).maybeSingle()
    content = athlete?.coach_id ? (
      <div className="text-center space-y-3">
        <h1 className="text-xl font-semibold">You already have a coach</h1>
        <p className="text-sm text-zinc-400">Ask your current coach to remove you from their roster first.</p>
        <Link href="/athlete/dashboard" className="inline-block text-sm text-blue-400 hover:text-blue-300">Go to dashboard</Link>
      </div>
    ) : (
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">Join {coachName}&apos;s team</h1>
        <p className="text-sm text-zinc-400">You&apos;ll see the programs and workouts {coachName} assigns you.</p>
        <JoinButton code={code} />
      </div>
    )
  } else {
    content = (
      <>
        <h1 className="text-xl font-semibold mb-1">Join {coachName}&apos;s team</h1>
        <p className="text-sm text-zinc-400 mb-6">Create your athlete account to get your workouts.</p>
        <JoinForm code={code} />
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
        {!user && coachName && (
          <p className="text-center text-sm text-zinc-500 mt-6">
            Already have an account?{' '}
            <Link href={`/login?next=/join/${code}`} className="text-blue-400 hover:text-blue-300 font-medium">Sign in</Link>
          </p>
        )}
        <p className="text-center text-xs text-zinc-600 mt-4">
          By creating an account you agree to our <Link href="/privacy" className="underline hover:text-zinc-400">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  )
}
