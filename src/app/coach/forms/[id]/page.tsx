import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { Card, CardContent } from '@/components/ui/Card'
import { FREQ_LABEL, formatAnswer, type FormRow } from '@/lib/forms'
import { ExportCsvButton, ExportExcelButton } from './ExportCsvButton'

export const dynamic = 'force-dynamic'

export default async function FormResponsesPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: coach } = await supabase.from('coaches').select('id').match(await coachMatch(supabase, user.id)).maybeSingle()
  const { data: form } = await supabase.from('forms').select('*').eq('id', params.id).maybeSingle()
  if (!form || !coach) notFound()
  const f = form as FormRow

  const [{ data: responses }, { data: athletes }, { data: leads }] = await Promise.all([
    supabase.from('form_responses').select('id, athlete_id, period, answers, submitted_at').eq('form_id', f.id).order('submitted_at', { ascending: false }).limit(1000),
    supabase.from('athletes').select('id, name').eq('coach_id', coach.id).order('name'),
    supabase.from('form_leads').select('id, name, email, answers, submitted_at').eq('form_id', f.id).order('submitted_at', { ascending: false }).limit(1000),
  ])
  const nameOf = new Map((athletes ?? []).map((a: any) => [a.id, a.name]))
  type Entry = { id: string; athlete_id: string; answers: Record<string, unknown>; submitted_at: string; who?: string; email?: string; lead?: boolean }
  const athleteRows = (responses ?? []) as Entry[]
  const answered = new Set(athleteRows.map(r => r.athlete_id))
  const missing = f.show_athletes === false ? [] : (athletes ?? []).filter((a: any) => !answered.has(a.id))
  const leadRows: Entry[] = ((leads ?? []) as any[]).map(l => ({ id: l.id, athlete_id: '', answers: l.answers, submitted_at: l.submitted_at, who: l.name, email: l.email, lead: true }))
  const rows = [...athleteRows, ...leadRows].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
  const nameFor = (r: Entry) => r.who ?? nameOf.get(r.athlete_id) ?? 'Athlete'

  const csv = [
    ['Name', 'Email', 'From', 'Submitted', ...f.questions.map(q => q.label)],
    ...rows.map(r => [nameFor(r), r.email ?? '', r.lead ? 'Public link' : 'Athlete', new Date(r.submitted_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }), ...f.questions.map(q => formatAnswer(q, r.answers?.[q.id]))]),
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/coach/forms" className="text-zinc-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{f.title}</h1>
          <p className="text-sm text-zinc-400">{FREQ_LABEL[f.frequency]} · {rows.length} responses</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/print/forms/${f.id}`} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:text-white">
            <FileText className="w-3.5 h-3.5" /> PDF (all)
          </a>
          <ExportExcelButton rows={csv} filename={`${f.title.replace(/[^\w]+/g, '-')}.xlsx`} sheet={f.title} />
          <ExportCsvButton rows={csv} filename={`${f.title.replace(/[^\w]+/g, '-')}.csv`} />
        </div>
      </div>

      {missing.length > 0 && f.frequency === 'once' && (
        <p className="text-xs text-zinc-400">Still waiting on: {missing.map((a: any) => a.name).join(', ')}</p>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-3 py-3">When</th>
                {f.questions.map(q => <th key={q.id} className="text-left px-3 py-3 max-w-[12rem]">{q.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((r, i) => (
                <tr key={i} className="align-top">
                  <td className="px-4 py-2.5 text-white whitespace-nowrap">
                    {nameFor(r)}
                    <a href={`/print/forms/${f.id}?${r.lead ? 'l' : 'r'}=${r.id}`} className="ml-2 text-xs text-blue-400 hover:text-blue-300">PDF</a>
                    {r.lead && <span className="block text-[11px] text-zinc-500">{r.email} · public link</span>}
                  </td>
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
