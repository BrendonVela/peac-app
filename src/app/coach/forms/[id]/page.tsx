import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { Card, CardContent } from '@/components/ui/Card'
import { FREQ_LABEL, formatAnswer, type FormRow } from '@/lib/forms'
import { ExportCsvButton, ExportExcelButton } from './ExportCsvButton'
import { cn, initials } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function FormResponsesPage({ params, searchParams }: { params: { id: string }; searchParams: { view?: string } }) {
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
  const nameFor = (r: Entry): string => String(r.who ?? nameOf.get(r.athlete_id) ?? 'Athlete')

  const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  const csv = [
    ['Name', 'Email', 'From', 'Submitted', ...f.questions.map(q => q.label)],
    ...rows.map(r => [nameFor(r), r.email ?? '', r.lead ? 'Public link' : 'Athlete', fmtDate(r.submitted_at), ...f.questions.map(q => formatAnswer(q, r.answers?.[q.id]))]),
  ]
  // Easy-to-read list: one line per answer
  const list = [
    ['Name', 'Email', 'Submitted', '#', 'Question', 'Answer'],
    ...rows.flatMap(r => f.questions.map((q, i) => [nameFor(r), r.email ?? '', fmtDate(r.submitted_at), i + 1, q.label, formatAnswer(q, r.answers?.[q.id])])),
  ]
  const byQuestion = searchParams.view === 'question'
  const flagged = (q: (typeof f.questions)[number], v: unknown) =>
    (q.type === 'yesno' && v === true && /pain|injur|hurt/i.test(q.label)) || (q.type === 'scale' && /pain|sore|hurt|stress/i.test(q.label) && Number(v) >= 7)
  const safe = f.title.replace(/[^\w]+/g, '-')

  // Totals per question (for the "By question" view)
  const summary = f.questions.map(q => {
    const vals = rows.map(r => ({ who: nameFor(r), v: r.answers?.[q.id] })).filter(x => x.v !== undefined && x.v !== null && x.v !== '' && !(Array.isArray(x.v) && x.v.length === 0))
    const counts = new Map<string, number>()
    vals.forEach(({ v }) => (Array.isArray(v) ? v : [formatAnswer(q, v)]).forEach(k => counts.set(String(k), (counts.get(String(k)) ?? 0) + 1)))
    const order = q.options?.length ? [...q.options, ...Array.from(counts.keys()).filter(k => !q.options!.includes(k))] : Array.from(counts.keys())
    const nums = vals.map(x => Number(x.v)).filter(n => !Number.isNaN(n))
    return {
      q,
      answered: vals.length,
      tally: q.type === 'text' ? [] : order.filter(k => counts.has(k)).map(k => ({ label: k, n: counts.get(k)! })).sort((a, b) => (q.type === 'scale' || q.type === 'number' ? Number(a.label) - Number(b.label) : 0)),
      avg: (q.type === 'scale' || q.type === 'number') && nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null,
      texts: q.type === 'text' ? vals.map(x => ({ who: x.who, text: String(x.v) })) : [],
    }
  })

  const tab = (on: boolean) => cn('rounded-lg px-3 py-1.5 text-sm font-semibold', on ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white')
  const btn = 'flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:text-white'

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-start gap-3">
        <Link href="/coach/forms" className="mt-1.5 text-zinc-400 hover:text-white" aria-label="Back to forms"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1 min-w-[14rem]">
          <h1>{f.title}</h1>
          <p className="mt-1 text-sm text-zinc-400">{FREQ_LABEL[f.frequency]} · {rows.length} {rows.length === 1 ? 'response' : 'responses'} · {f.questions.length} questions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/print/forms/${f.id}`} className={btn}><FileText className="w-3.5 h-3.5" /> PDF (all)</a>
          <ExportExcelButton rows={csv} list={list} filename={`${safe}.xlsx`} />
          <ExportCsvButton rows={list} filename={`${safe}.csv`} />
        </div>
      </div>

      {missing.length > 0 && f.frequency === 'once' && (
        <details className="rounded-xl border border-line bg-panel px-4 py-3 text-sm">
          <summary className="cursor-pointer text-zinc-300">Still waiting on <b>{missing.length}</b> {missing.length === 1 ? 'athlete' : 'athletes'}</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {missing.map((a: any) => <span key={a.id} className="rounded-full bg-panel2 px-3 py-1 text-xs text-zinc-300">{a.name}</span>)}
          </div>
        </details>
      )}

      {rows.length > 0 && (
        <div className="inline-flex rounded-xl border border-line bg-panel p-1">
          <Link href={`/coach/forms/${f.id}`} className={tab(!byQuestion)}>By person</Link>
          <Link href={`/coach/forms/${f.id}?view=question`} className={tab(byQuestion)}>By question</Link>
        </div>
      )}

      {rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-zinc-500">No responses yet.</CardContent></Card>
      ) : !byQuestion ? (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <details key={r.id} open={i === 0} className="group rounded-2xl border border-line bg-panel">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-panel2 text-xs font-bold">{initials(nameFor(r))}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-white">{nameFor(r)}</span>
                  <span className="block text-xs text-zinc-500">{fmtDate(r.submitted_at)}{r.lead ? ` · ${r.email} · public link` : ''}</span>
                </span>
                {f.questions.some(q => flagged(q, r.answers?.[q.id])) && <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-300">Needs a look</span>}
                <a href={`/print/forms/${f.id}?${r.lead ? 'l' : 'r'}=${r.id}`} className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:text-white">PDF</a>
                <span className="text-xs text-zinc-500 group-open:hidden">Show</span>
                <span className="hidden text-xs text-zinc-500 group-open:inline">Hide</span>
              </summary>
              <dl className="grid gap-x-6 border-t border-line px-5 py-4 sm:grid-cols-2">
                {f.questions.map((q, k) => {
                  const v = r.answers?.[q.id]
                  return (
                    <div key={q.id} className="border-b border-line/60 py-2.5 last:border-0 sm:[&:nth-last-child(2)]:border-0">
                      <dt className="text-xs text-zinc-500">{k + 1}. {q.label}</dt>
                      <dd className={cn('mt-0.5 text-sm', flagged(q, v) ? 'font-semibold text-red-300' : 'text-white')}>{formatAnswer(q, v)}</dd>
                    </div>
                  )
                })}
              </dl>
            </details>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {summary.map(({ q, answered, tally, avg, texts }, k) => {
            const max = Math.max(1, ...tally.map(t => t.n))
            return (
              <Card key={q.id}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-white">{k + 1}. {q.label}</p>
                    <p className="text-xs text-zinc-500">{answered} of {rows.length} answered{avg !== null ? ` · average ${avg.toFixed(1)}` : ''}</p>
                  </div>
                  {tally.length > 0 && (
                    <div className="space-y-1.5">
                      {tally.map(t => (
                        <div key={t.label} className="grid grid-cols-[minmax(0,10rem)_1fr_2rem] items-center gap-3 text-sm">
                          <span className="truncate text-zinc-300">{t.label}</span>
                          <span className="h-2.5 rounded-full bg-panel2"><span className="block h-full rounded-full bg-blue-500" style={{ width: `${(t.n / max) * 100}%` }} /></span>
                          <span className="text-right text-zinc-400">{t.n}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {texts.length > 0 && (
                    <ul className="space-y-1.5">
                      {texts.map((t, i) => <li key={i} className="text-sm"><span className="text-zinc-500">{t.who}:</span> <span className="text-white">{t.text}</span></li>)}
                    </ul>
                  )}
                  {answered === 0 && <p className="text-sm text-zinc-500">No answers yet.</p>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
