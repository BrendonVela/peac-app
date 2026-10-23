import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { athleteMatch } from '@/lib/acting'
import { currentPeriod, FREQ_LABEL, type FormRow } from '@/lib/forms'
import { FillForm } from './FillForm'

export const dynamic = 'force-dynamic'

export default async function FillFormPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('athletes').select('id').match(await athleteMatch(supabase, user.id)).maybeSingle()
  if (!me) redirect('/login')
  const { data: forms } = await supabase.rpc('my_forms')
  const form = ((forms ?? []) as FormRow[]).find(f => f.id === params.id)
  if (!form) notFound()
  const { data: existing } = await supabase
    .from('form_responses')
    .select('answers')
    .eq('form_id', form.id)
    .eq('athlete_id', me.id)
    .eq('period', currentPeriod(form.frequency))
    .maybeSingle()

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/athlete/forms" className="text-zinc-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold">{form.title}</h1>
          <p className="text-sm text-zinc-400">{form.description || FREQ_LABEL[form.frequency]}</p>
        </div>
      </div>
      <FillForm form={form} initial={(existing?.answers as Record<string, unknown>) ?? {}} />
    </div>
  )
}
