import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { athleteMatch } from '@/lib/acting'
import { Card, CardContent } from '@/components/ui/Card'
import { getMyForms } from '@/lib/dueForms'
import { FREQ_LABEL } from '@/lib/forms'

export const dynamic = 'force-dynamic'

export default async function AthleteFormsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('athletes').select('id').match(await athleteMatch(supabase, user.id)).maybeSingle()
  if (!me) redirect('/login')
  const { due, done } = await getMyForms(supabase, me.id)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Forms</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Quick questions from your coach.</p>
      </div>
      {due.length === 0 && done.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-zinc-500">No forms right now.</CardContent></Card>
      )}
      {due.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-400">To do</h2>
          {due.map(f => (
            <Link key={f.id} href={`/athlete/forms/${f.id}`} className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-zinc-900 px-4 py-3 hover:border-amber-500/60">
              <span className="flex-1 min-w-0">
                <span className="block text-white font-medium truncate">{f.title}</span>
                <span className="block text-xs text-zinc-500">{FREQ_LABEL[f.frequency]} · {f.questions.length} questions</span>
              </span>
              <ChevronRight className="w-5 h-5 text-zinc-500" />
            </Link>
          ))}
        </div>
      )}
      {done.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Done</h2>
          {done.map(f => (
            <Link key={f.id} href={`/athlete/forms/${f.id}`} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span className="flex-1 min-w-0 text-zinc-300 truncate">{f.title}</span>
              <span className="text-xs text-zinc-500">Edit</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
