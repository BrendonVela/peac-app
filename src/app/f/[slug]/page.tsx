import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logoUrl, cleanColor, lighten } from '@/lib/brand'
import type { Question } from '@/lib/forms'
import { PeacLogo } from '@/components/brand/PeacLogo'
import { PublicForm } from './PublicForm'

export const dynamic = 'force-dynamic'

type Row = { id: string; title: string; description: string | null; questions: Question[]; brand_name: string | null; brand_color: string | null; brand_logo_path: string | null }

async function load(slug: string): Promise<Row | null> {
  const supabase = createClient()
  const { data } = await supabase.rpc('get_public_form', { p_slug: slug })
  return ((data ?? []) as Row[])[0] ?? null
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const f = await load(params.slug)
  return { title: f ? `${f.title} · ${f.brand_name || 'PEAC'}` : 'Form not found', robots: { index: false } }
}

/** Public form: anyone with the link can fill it out, no account needed */
export default async function PublicFormPage({ params }: { params: { slug: string } }) {
  const f = await load(params.slug)
  if (!f) notFound()
  const color = cleanColor(f.brand_color)
  const logo = logoUrl(f.brand_logo_path)
  const style = color ? ({ ['--brand' as string]: color, ['--brand-text' as string]: lighten(color, 0.35) } as React.CSSProperties) : undefined

  return (
    <div className={`min-h-screen bg-ink ${color ? 'branded' : ''}`} style={style}>
      <div className="relative overflow-hidden border-b border-line">
        <div className="peac-aurora absolute inset-0" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/20 to-ink" aria-hidden="true" />
        <div className="relative mx-auto max-w-2xl px-5 pt-10 pb-8">
          {logo ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="" className="h-12 w-auto max-w-[9rem] object-contain" />
              <span className="font-display text-3xl font-extrabold uppercase tracking-wide">{f.brand_name || 'PEAC'}</span>
            </div>
          ) : (
            <PeacLogo size="lg" name={f.brand_name} />
          )}
          <h1 className="mt-6 font-display italic text-5xl font-extrabold uppercase leading-[0.95]">{f.title}</h1>
          {f.description && <p className="mt-3 text-zinc-300">{f.description}</p>}
        </div>
      </div>
      <main className="mx-auto max-w-2xl px-5 py-8">
        <PublicForm slug={params.slug} title={f.title} questions={f.questions} brand={f.brand_name || 'PEAC Performance'} />
      </main>
    </div>
  )
}
