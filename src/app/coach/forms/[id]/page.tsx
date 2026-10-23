import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { Card, CardContent } from '@/components/ui/Card'
import { FREQ_LABEL, formatAnswer, type FormRow } from '@/lib/forms'
import { ExportCsvButton } from './ExportCsvButton'

export const dynamic = 'force-dynamic'

export default async function FormResponsesPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: coach } = await supabase.from('coaches').select('id').match(await coachMatch(supabase, user.id)).maybeSingle()
  const { data: form } = await supabase.from('forms').select('*').eq('id', params.id).maybeSingle()
  if (!form || !coach) notFound()
  const f = form as FormRow

  const [{ data: responses }, { data: athletes }] = await Promise.all([
    supabase.from('form_responses').select('athlete_id, period, answers, submitted_at').eq('form_id', f.id).order('submitted_at', { ascending: false }).limit(1000),
    supabase.from('athletes').select('id, name').eq('coach_id', coach.id).order('name'),
  ])
  const nameOf = new Map((athletes ?? []).map((a: any) => [a.id, a.name]))
  const rows = (responses ?? []) as { athlete_id: string; period: string; answers: Record<string, unknown>; submitted_at: string }[]
  const answered = new Set(rows.map(r => r.athlete_id))
  const missing = (athletes ?? []).filter((a: any) => !answered.has(a.id))

  const csv = [
    ['Athlete', 'Submitted', ...f.questions.map(q => q.label)],
    ...rows.map(r => [nameOf.get(r.athlete_id) ?? 'Athlete', new Date(r.submitted_at).toLocaleString('en-US'), ...f.questions.map(q => formatAnswer(q, r.answers?.[q.id]))]),
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/coach/forms" className="text-zinc-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{f.title}</h1>
          <p className="text-sm text-zinc-400">{FREQ_LABEL[f.frequency]} · {rows.length} responses</p>
        </div>
        <ExportCsvButton rows={csv} filename={`${f.title.replace(/[^\w]+/g, '-')}.csv`} />
      </div>

      {missing.length > 0 && f.frequency === 'once' && (
        <p className="text-xs text-zinc-400">Still waiting on: {missing.map((a: any) => a.name).join(', ')}</p>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3">Athlete</th>
                <th className="text-left px-3 py-3">When</th>
                {f.questions.map(q => <th key={q.id} className="text-left px-3 py-3 max-w-[12rem]">{q.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((r, i) => (
                <tr key={i} className="align-top">
                  <td className="px-4 py-2.5 text-white whitespace-nowrap">{nameOf.get(r.athlete_id) ?? 'Athlete'}</td>
                  <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">{new Date(r.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                  {f.questions.map(q => {
                    const v = r.answers?.[q.id]
                    const flag = (q.type === 'yesno' && v === true && /pain|injur|hurt/i.test(q.label)) || (q.type === 'scale' && /pain|sore|hurt/i.test(q.label) && Number(v) >= 7)
                    return <td key={q.id} className={`px-3 py-2.5 ${flag ? 'text-red-400 font-semibold' : 'text-zinc-300'}`}>{formatAnswer(q, v)}</td>
                  })}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={2 + f.questions.length} className="px-4 py-8 text-center text-zinc-500">No responses yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
