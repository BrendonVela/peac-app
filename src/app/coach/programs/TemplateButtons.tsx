'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutTemplate, Copy, Trash2, Globe, Lock } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { saveAsTemplate, startFromTemplate, deleteTemplate, setTemplateShared } from '@/app/actions/templates'

const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500'

/** On a normal program: save a copy as a template */
export function SaveAsTemplateButton({ programId, title, isAdmin }: { programId: string; title: string; isAdmin: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [share, setShare] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setBusy(true); setError('')
    const res = await saveAsTemplate(programId, name, desc, share)
    setBusy(false)
    if ('error' in res && res.error) { setError(res.error); return }
    setOpen(false)
    router.push(`/coach/programs/${res.id}`)
  }

  return (
    <>
      <button
        onClick={() => { setName(title.replace(/\s+—\s+.+$/, '')); setDesc(''); setShare(false); setError(''); setOpen(true) }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:text-white"
      >
        <LayoutTemplate className="w-3.5 h-3.5" /> Save as template
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Save as template">
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">Saves a copy you can reuse for any athlete. Athletes and their logs aren&apos;t copied.</p>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Template name, e.g. 8-Week Off-Season Baseball" className={inputCls} />
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Who it's for / what it does (optional)" className={`${inputCls} resize-none`} />
          <p className="text-[11px] text-amber-300/80">Tip: remove athlete names from the name and notes before sharing.</p>
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)} className="accent-blue-600" />
              Share with every coach on PEAC
            </label>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={save} loading={busy}>Save template</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

/** Start a new program from a template */
export function UseTemplateButton({ templateId, title, big = false }: { templateId: string; title: string; big?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(title)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function go() {
    setBusy(true); setError('')
    const res = await startFromTemplate(templateId, name)
    setBusy(false)
    if ('error' in res && res.error) { setError(res.error); return }
    router.push(`/coach/programs/${res.id}?edit=1`)
  }

  return (
    <>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setName(title); setError(''); setOpen(true) }}
        className={big
          ? 'inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white'
          : 'inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white'}
      >
        <Copy className="w-3.5 h-3.5" /> Use template
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New program from template">
        <div className="space-y-3" onClick={e => e.stopPropagation()}>
          <p className="text-sm text-zinc-400">Makes your own copy. Edit it however you like, then assign athletes.</p>
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={go} loading={busy}>Create program</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

/** Owner / admin controls on a template */
export function TemplateOwnerButtons({ templateId, shared, isAdmin, canDelete }: { templateId: string; shared: boolean; isAdmin: boolean; canDelete: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <span className="inline-flex items-center gap-1">
      {isAdmin && (
        <button
          disabled={busy}
          onClick={async e => { e.preventDefault(); e.stopPropagation(); setBusy(true); await setTemplateShared(templateId, !shared); setBusy(false); router.refresh() }}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:text-white"
          title={shared ? 'Shared with every coach — click to make private' : 'Private — click to share with every coach'}
        >
          {shared ? <><Globe className="w-3.5 h-3.5" /> Shared</> : <><Lock className="w-3.5 h-3.5" /> Private</>}
        </button>
      )}
      {canDelete && (
        <button
          disabled={busy}
          onClick={async e => {
            e.preventDefault(); e.stopPropagation()
            if (!confirm('Delete this template? Programs already made from it are not affected.')) return
            setBusy(true); await deleteTemplate(templateId); setBusy(false); router.refresh()
          }}
          className="p-1.5 text-zinc-500 hover:text-red-400"
          title="Delete template"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </span>
  )
}
