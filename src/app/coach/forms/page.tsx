import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FREQ_LABEL, type FormRow } from '@/lib/forms'
import { FormEditor } from './FormEditor'
import { FormRowActions } from './FormRowActions'

export const dynamic = 'force-dynamic'

export default async function CoachFormsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: coach } = await supabase.from('coaches').select('id').match(await coachMatch(supabase, user.id)).maybeSingle()
  if (!coach) redirect('/login')

  const [{ data: forms }, { data: counts }] = await Promise.all([
    supabase.from('forms').select('*').eq('coach_id', coach.id).order('created_at', { ascending: false }),
    supabase.from('form_responses').select('form_id'),
  ])
  const countBy = new Map<string, number>()
  ;(counts ?? []).forEach((r: any) => countBy.set(r.form_id, (countBy.get(r.form_id) ?? 0) + 1))
  const list = (forms ?? []) as FormRow[]

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Forms</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Questionnaires for your athletes — injury reports, sleep logs, goals.</p>
        </div>
        <FormEditor trigger={<Button size="sm"><Plus className="w-4 h-4" /> New form</Button>} />
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <ClipboardList className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm text-zinc-400">No forms yet. Tap <b>New form</b> — you can start from a template.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map(f => (
            <Card key={f.id}>
              <CardContent className="py-4 flex flex-wrap items-center gap-3">
                <Link href={`/coach/forms/${f.id}`} className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{f.title}</p>
                  <p className="text-xs text-zinc-500">
                    {FREQ_LABEL[f.frequency]} · {f.questions.length} question{f.questions.length === 1 ? '' : 's'} · {countBy.get(f.id) ?? 0} responses
                  </p>
                </Link>
                <Badge variant={f.active ? 'green' : 'default'}>{f.active ? 'Active' : 'Off'}</Badge>
                <FormRowActions form={f} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
