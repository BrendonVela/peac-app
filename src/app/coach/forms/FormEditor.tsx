'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { saveForm } from '@/app/actions/forms'
import { listGroups, type Group } from '@/app/actions/groups'
import { TYPE_LABEL, FREQ_LABEL, hasOptions, type Question, type QuestionType, type FormRow } from '@/lib/forms'
import type { FormDraft } from '@/lib/formParse'
import { cn } from '@/lib/utils'

const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500'

const TEMPLATES: { title: string; frequency: FormRow['frequency']; questions: Omit<Question, 'id'>[] }[] = [
  { title: 'Injury / pain report', frequency: 'daily', questions: [
    { label: 'Any pain or injury today?', type: 'yesno', required: true },
    { label: 'Where does it hurt?', type: 'text' },
    { label: 'How bad is it?', type: 'scale' },
  ] },
  { title: 'Weekly sleep & recovery', frequency: 'weekly', questions: [
    { label: 'Average hours of sleep per night', type: 'number', required: true },
    { label: 'How recovered do you feel?', type: 'scale', required: true },
    { label: 'Anything your coach should know?', type: 'text' },
  ] },
  { title: 'Season goals', frequency: 'once', questions: [
    { label: 'Your #1 goal this season', type: 'text', required: true },
    { label: 'Position', type: 'choice', options: ['Pitcher', 'Catcher', 'Infield', 'Outfield'] },
  ] },
  { title: 'PEAC Quick Assessment', frequency: 'once', questions: [
    { label: 'Age range', type: 'choice', options: ['Under 15', '15–17', '18–24', '25–34', '35–44', '45+'] },
    { label: 'Gender identity', type: 'choice', options: ['Male', 'Female', 'Non-binary', 'Prefer not to say'] },
    { label: 'Sport or activity', type: 'choice', required: true, options: ['Football', 'Soccer', 'Basketball', 'Baseball / Softball', 'Track & Field', 'Swimming', 'Wrestling / Combat', 'Volleyball', 'Rugby', 'Tennis', 'General Fitness', 'Other'] },
    { label: 'Competition level', type: 'choice', options: ['Youth', 'Recreational', 'High School', 'College', 'Semi-Pro / Pro', 'Masters / Veteran'] },
    { label: 'Experience level', type: 'choice', required: true, options: ['Beginner (under 1 year)', 'Intermediate (1–3 years)', 'Advanced (3–5 years)', 'Elite (5+ years)'] },
    { label: 'Days available to train per week', type: 'choice', required: true, options: ['2', '3', '4', '5', '6', '6+'] },
    { label: 'Preferred session length', type: 'choice', options: ['Under 45 min', '45–60 min', '60–90 min', '90+ min'] },
    { label: 'Current season or training phase', type: 'choice', options: ['Off-season', 'Pre-season', 'In-season', 'Post-season', 'Year-round'] },
    { label: 'Available equipment', type: 'multi', options: ['Full gym', 'Olympic platform', 'Dumbbells / kettlebells', 'Resistance bands', 'Pull-up / dip station', 'Cardio machines', 'Turf / agility track', 'Bodyweight only'] },
    { label: 'Preferred training methods', type: 'multi', options: ['Heavy compound lifts', 'Olympic lifting', 'Dumbbell / kettlebell', 'Plyometrics / jumps', 'Sprint / speed work', 'HIIT / circuits', 'Steady-state cardio', 'Mobility / flexibility', 'Machine isolation', 'Agility drills'] },
    { label: 'Training goals', type: 'multi', required: true, options: ['Build muscle & strength', 'Lose body fat', 'Sport performance', 'Speed & power', 'Cardio endurance', 'Injury prevention', 'General health', 'Return to sport', 'Agility / change of direction', 'Vertical jump'] },
    { label: 'Target timeline', type: 'choice', options: ['4–6 weeks', '8–12 weeks', '3–6 months', '6–12 months', 'Ongoing'] },
    { label: 'Motivation level right now (1 = just getting started, 10 = fully committed)', type: 'scale' },
    { label: 'Current body weight range', type: 'choice', options: ['Under 120 lbs', '120–149 lbs', '150–179 lbs', '180–209 lbs', '210–239 lbs', '240+ lbs', 'Prefer not to say'] },
    { label: 'Estimated body fat %', type: 'choice', options: ['Under 10%', '10–15%', '16–20%', '21–25%', '26–30%', '30%+', 'Not sure'] },
    { label: 'Primary body composition focus', type: 'choice', options: ['Gain lean muscle', 'Lose body fat', 'Recomposition', 'Maintain', 'Weight class'] },
    { label: 'Nutrition approach', type: 'choice', options: ['No specific approach', 'Tracking macros', 'High protein', 'Vegan / plant-based', 'Keto', 'Intermittent fasting', 'With a dietitian'] },
    { label: 'Current injury status', type: 'choice', options: ['Fully healthy', 'Minor niggles', 'Need modifications', 'Post-surgery / recovering'] },
    { label: 'Areas to be cautious with', type: 'multi', options: ['Lower back', 'Knee(s)', 'Shoulder(s)', 'Hip(s)', 'Ankle(s)', 'Neck / upper back', 'Elbow(s) / wrist(s)', 'None'] },
    { label: 'Average sleep per night', type: 'choice', options: ['Under 5 hrs', '5–6 hrs', '6–7 hrs', '7–8 hrs', '8+ hrs'] },
    { label: 'Overall stress level (1 = very low, 10 = extremely high)', type: 'scale' },
    { label: 'Health conditions relevant to training', type: 'multi', options: ['Asthma / respiratory', 'High blood pressure', 'Diabetes', 'Cardiac condition', 'Joint / arthritis', 'None'] },
    { label: 'How did you hear about PEAC Performance?', type: 'choice', options: ['Coach referral', 'Friend / teammate', 'Instagram', 'Google', 'Other'] },
  ] },
]

const newId = () => Math.random().toString(36).slice(2, 10)

export function FormEditor({ form, trigger, draft, defaultOpen = false, onClosed }: {
  form?: FormRow
  trigger?: React.ReactNode
  /** Questions read from an imported file: opens the editor pre-filled, not saved yet */
  draft?: FormDraft
  defaultOpen?: boolean
  onClosed?: () => void
}) {
  const router = useRouter()
  const [open, setOpenRaw] = useState(defaultOpen)
  const setOpen = (v: boolean) => { setOpenRaw(v); if (!v) onClosed?.() }
  const [title, setTitle] = useState(form?.title ?? draft?.title ?? '')
  const [description, setDescription] = useState(form?.description ?? draft?.description ?? '')
  const [frequency, setFrequency] = useState<FormRow['frequency']>(form?.frequency ?? 'once')
  const [groupId, setGroupId] = useState<string>(form?.group_id ?? '')
  const [active, setActive] = useState(form?.active ?? true)
  const [questions, setQuestions] = useState<Question[]>(
    form?.questions ?? draft?.questions.map(q => ({ ...q, id: newId() })) ?? [{ id: newId(), label: '', type: 'scale', required: true }]
  )
  const [groups, setGroups] = useState<Group[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (open) listGroups().then(setGroups) }, [open])

  function update(i: number, patch: Partial<Question>) {
    setQuestions(qs => qs.map((q, k) => (k === i ? { ...q, ...patch } : q)))
  }
  function move(i: number, d: number) {
    setQuestions(qs => {
      const j = i + d
      if (j < 0 || j >= qs.length) return qs
      const n = [...qs]; [n[i], n[j]] = [n[j], n[i]]; return n
    })
  }
  function useTemplate(t: (typeof TEMPLATES)[number]) {
    setTitle(t.title); setFrequency(t.frequency)
    setQuestions(t.questions.map(q => ({ ...q, id: newId() })))
  }

  async function save() {
    setBusy(true); setError('')
    const res = await saveForm({ id: form?.id, title, description, frequency, questions, group_id: groupId || null, active })
    setBusy(false)
    if ('error' in res && res.error) { setError(res.error); return }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      {trigger && <span onClick={() => setOpen(true)}>{trigger}</span>}
      <Modal open={open} onClose={() => setOpen(false)} title={form ? 'Edit form' : draft ? 'Check your imported form' : 'New form'} className="max-w-2xl">
        <div className="space-y-4">
          {draft && (
            <p className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
              We read {draft.questions.length} questions from your file. Check each one (wording, answer type, options), then tap <b>Save form</b>.
            </p>
          )}
          {!form && !draft && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-zinc-500">Start from:</span>
              {TEMPLATES.map(t => (
                <button key={t.title} onClick={() => useTemplate(t)} className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:text-white">{t.title}</button>
              ))}
            </div>
          )}
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Form title" className={inputCls} />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description (optional)" className={inputCls} />
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-zinc-400 space-y-1">How often
              <select value={frequency} onChange={e => setFrequency(e.target.value as FormRow['frequency'])} className={inputCls}>
                {Object.entries(FREQ_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="text-xs text-zinc-400 space-y-1">Who
              <select value={groupId} onChange={e => setGroupId(e.target.value)} className={inputCls}>
                <option value="">All my athletes</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.athleteIds.length})</option>)}
              </select>
            </label>
          </div>

          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={q.id} className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 w-5">{i + 1}.</span>
                  <input value={q.label} onChange={e => update(i, { label: e.target.value })} placeholder="Question" className={inputCls} />
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-7">
                  <select value={q.type} onChange={e => update(i, { type: e.target.value as QuestionType, options: hasOptions(e.target.value as QuestionType) ? (q.options?.length ? q.options : ['', '']) : undefined })} className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-white">
                    {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <input type="checkbox" checked={!!q.required} onChange={e => update(i, { required: e.target.checked })} className="accent-blue-600" /> Required
                  </label>
                  <span className="flex-1" />
                  <button onClick={() => move(i, -1)} className="p-1 text-zinc-500 hover:text-white"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => move(i, 1)} className="p-1 text-zinc-500 hover:text-white"><ArrowDown className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setQuestions(qs => qs.filter((_, k) => k !== i))} className="p-1 text-zinc-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                {hasOptions(q.type) && (
                  <div className="pl-7 space-y-1.5">
                    {(q.options ?? []).map((o, k) => (
                      <div key={k} className="flex gap-2">
                        <input value={o} onChange={e => update(i, { options: (q.options ?? []).map((x, m) => (m === k ? e.target.value : x)) })} placeholder={`Option ${k + 1}`} className={cn(inputCls, 'py-1.5')} />
                        <button onClick={() => update(i, { options: (q.options ?? []).filter((_, m) => m !== k) })} className="p-1 text-zinc-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                    <button onClick={() => update(i, { options: [...(q.options ?? []), ''] })} className="text-xs text-blue-400">+ Add option</button>
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setQuestions(qs => [...qs, { id: newId(), label: '', type: 'text' }])} className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300">
              <Plus className="w-4 h-4" /> Add question
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="accent-blue-600" /> Active (athletes can see it)
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={save} loading={busy}>Save form</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
