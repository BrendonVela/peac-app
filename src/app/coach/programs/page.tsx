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

  const { data: programs } = await supabase
    .from('programs')
    .select('id, title, description, created_at')
    .eq('coach_id', coach?.id ?? '')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Programs</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{programs?.length ?? 0} total</p>
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

      {programs && programs.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map(program => (
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
