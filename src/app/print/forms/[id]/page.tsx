import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { formatAnswer, FREQ_LABEL, type FormRow } from '@/lib/forms'
import { PrintBar } from './PrintBar'

export const dynamic = 'force-dynamic'

/** Printable copy of form responses. Opens the print window so the coach can "Save as PDF". */
export default async function PrintFormResponses({ params, searchParams }: { params: { id: string }; searchParams: { r?: string; l?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: coach } = await supabase.from('coaches').select('id').match(await coachMatch(supabase, user.id)).maybeSingle()
  const { data: form } = await supabase.from('forms').select('*').eq('id', params.id).maybeSingle()
  if (!form || !coach) notFound()
  const f = form as FormRow

  let q = supabase.from('form_responses').select('id, athlete_id, period, answers, submitted_at').eq('form_id', f.id).order('submitted_at', { ascending: false }).limit(500)
  let lq = supabase.from('form_leads').select('id, name, email, answers, submitted_at').eq('form_id', f.id).order('submitted_at', { ascending: false }).limit(500)
  if (searchParams.r) q = q.eq('id', searchParams.r)
  if (searchParams.l) lq = lq.eq('id', searchParams.l)
  const [{ data: responses }, { data: athletes }, { data: leads }] = await Promise.all([
    searchParams.l ? Promise.resolve({ data: [] }) : q,
    supabase.from('athletes').select('id, name').eq('coach_id', coach.id),
    searchParams.r ? Promise.resolve({ data: [] }) : lq,
  ])
  const nameOf = new Map((athletes ?? []).map((a: { id: string; name: string }) => [a.id, a.name]))
  type Entry = { id: string; athlete_id: string; answers: Record<string, unknown>; submitted_at: string; who?: string; email?: string }
  const rows = [
    ...((responses ?? []) as Entry[]),
    ...((leads ?? []) as { id: string; name: string; email: string; answers: Record<string, unknown>; submitted_at: string }[]).map(l => ({ id: l.id, athlete_id: '', answers: l.answers, submitted_at: l.submitted_at, who: l.name, email: l.email })),
  ].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)) as Entry[]
  const nameFor = (r: Entry) => r.who ?? nameOf.get(r.athlete_id) ?? 'Athlete'
  const single = rows.length === 1 ? nameFor(rows[0]) : null
  const docTitle = `${f.title}${single ? ` - ${single}` : ''}`

  return (
    <div className="print-page min-h-screen bg-white text-zinc-900">
      <style>{`
        @media print {
          @page { margin: 14mm; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .response { break-after: page; }
          .response:last-child { break-after: auto; }
        }
      `}</style>
      <PrintBar title={docTitle} count={rows.length} backHref={`/coach/forms/${f.id}`} />
      <div className="mx-auto max-w-3xl px-6 py-8 space-y-10">
        {rows.length === 0 && <p className="text-sm text-zinc-500">No responses yet.</p>}
        {rows.map(r => (
          <section key={r.id} className="response">
            <header className="border-b-2 border-zinc-900 pb-3 mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">PEAC · {FREQ_LABEL[f.frequency]}</p>
              <h1 className="mt-1 text-2xl font-extrabold">{f.title}</h1>
              <p className="mt-1 text-sm text-zinc-700">
                <b>{nameFor(r)}</b>{r.email ? ` (${r.email})` : ''} · Submitted {new Date(r.submitted_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </header>
            <ol className="space-y-3">
              {f.questions.map((qq, i) => (
                <li key={qq.id} className="break-inside-avoid border-b border-zinc-200 pb-2">
                  <p className="text-sm font-semibold">{i + 1}. {qq.label}</p>
                  <p className="mt-0.5 text-sm text-zinc-800 whitespace-pre-wrap">{formatAnswer(qq, r.answers?.[qq.id])}</p>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  )
}
