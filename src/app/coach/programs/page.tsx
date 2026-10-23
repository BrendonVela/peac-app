import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, BookOpen, Upload } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import { importProgramFromExcel } from '@/app/actions/importProgram'
import { ImportDocument } from './ImportDocument'
import { UseTemplateButton, TemplateOwnerButtons } from './TemplateButtons'
import { LayoutTemplate } from 'lucide-react'

// Big Excel imports can take a while
export const maxDuration = 300

export default async function ProgramsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .match(await coachMatch(supabase, user.id))
    .single()

  // Programs vs. templates (falls back to the old list if the template columns aren't set up yet)
  let { data: all, error: listErr } = await supabase
    .from('programs')
    .select('id, title, description, created_at, is_template, is_public_template, coach_id')
    .or(`coach_id.eq.${coach?.id ?? '00000000-0000-0000-0000-000000000000'},is_public_template.eq.true`)
    .order('created_at', { ascending: false })
  if (listErr) {
    const r = await supabase.from('programs').select('id, title, description, created_at, coach_id').eq('coach_id', coach?.id ?? '').order('created_at', { ascending: false })
    all = (r.data ?? []).map((p: any) => ({ ...p, is_template: false, is_public_template: false }))
  }
  const programs = (all ?? []).filter((p: any) => !p.is_template && p.coach_id === coach?.id)
  const templates = (all ?? []).filter((p: any) => p.is_template)
  const { data: isAdmin } = await supabase.rpc('is_admin')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Programs</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{programs.length} total</p>
        </div>
        <Link href="/coach/programs/new">
          <Button size="sm">
            <Plus className="w-4 h-4" />
            New Program
          </Button>
        </Link>
      </div>
      
      <form action={importProgramFromExcel} className="flex flex-wrap items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
        <Upload className="w-4 h-4 text-zinc-400 shrink-0" />
        <input
          type="file"
          name="file"
          accept=".xlsx,.xls"
          required
          className="flex-1 min-w-0 text-sm text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-blue-600 file:text-white file:text-sm file:font-medium file:cursor-pointer hover:file:bg-blue-700"
        />
        <Button type="submit" size="sm" variant="secondary">
          Import
        </Button>
      </form>

      <ImportDocument />

      {/* Templates */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="w-4 h-4 text-violet-300" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">Templates</h2>
          <span className="text-xs text-zinc-500">· start a new program in one tap</span>
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-zinc-500">No templates yet. Open any program and tap <b>Save as template</b>.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((t: any) => {
              const mine = t.coach_id === coach?.id
              return (
                <Link key={t.id} href={`/coach/programs/${t.id}`}>
                  <Card className="h-full border-violet-600/30 hover:border-violet-500/60 transition-colors">
                    <CardContent className="py-4 flex flex-col gap-2 h-full">
                      <div className="flex items-start gap-2">
                        <p className="flex-1 font-semibold text-white">{t.title}</p>
                        {(mine || isAdmin === true) && <TemplateOwnerButtons templateId={t.id} shared={!!t.is_public_template} isAdmin={isAdmin === true} canDelete={mine || isAdmin === true} />}
                      </div>
                      {t.description && <p className="text-xs text-zinc-400 line-clamp-2">{t.description}</p>}
                      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-zinc-500">{t.is_public_template ? 'PEAC template' : 'Your template'}</span>
                        <UseTemplateButton templateId={t.id} title={t.title} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300 pt-2">Your programs</h2>

      {programs.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((program: any) => (
            <Link key={program.id} href={`/coach/programs/${program.id}`}>
              <Card className="hover:border-zinc-700 transition-colors cursor-pointer h-full">
                <CardContent className="py-5 flex flex-col gap-3">
                  <div className="p-2 bg-blue-600/10 rounded-lg w-fit">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{program.title}</h3>
                    {program.description && (
                      <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{program.description}</p>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">{formatDate(program.created_at)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-20 text-center">
            <BookOpen className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-400 mb-4">No programs yet. Build your first training program.</p>
            <Link href="/coach/programs/new">
              <Button>
                <Plus className="w-4 h-4" />
                Build Program
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
