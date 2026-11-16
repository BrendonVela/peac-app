'use client'

import { useRef, useState } from 'react'
import { FileUp, ClipboardPaste } from 'lucide-react'
import { parseFormFile, parseFormPaste } from '@/app/actions/formImport'
import type { FormDraft } from '@/lib/formParse'
import { FormEditor } from './FormEditor'

/** Drop in a PDF, Word, Excel or text file (or paste questions) and turn it into a PEAC form */
export function ImportForm() {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [draft, setDraft] = useState<FormDraft | null>(null)
  const [draftKey, setDraftKey] = useState(0)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [paste, setPaste] = useState('')
  const [dragging, setDragging] = useState(false)

  async function readFile(f: File) {
    setBusy(true); setMsg('')
    const fd = new FormData()
    fd.append('file', f)
    try {
      const res = await parseFormFile(fd)
      if ('error' in res) setMsg(res.error)
      else { setDraft(res.draft); setDraftKey(k => k + 1) }
    } catch {
      setMsg('That took too long or the file was too big. Try a smaller file.')
    }
    setBusy(false)
  }

  async function readPaste() {
    setBusy(true); setMsg('')
    const res = await parseFormPaste(paste)
    setBusy(false)
    if ('error' in res) { setMsg(res.error); return }
    setPasteOpen(false); setPaste('')
    setDraft(res.draft); setDraftKey(k => k + 1)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) readFile(f) }}
      className={`rounded-2xl border border-dashed px-4 py-4 transition-colors ${dragging ? 'border-blue-400 bg-blue-500/10' : 'border-zinc-700 bg-panel'}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <FileUp className="w-5 h-5 text-blue-400 shrink-0" />
        <div className="flex-1 min-w-[12rem]">
          <p className="text-sm font-semibold text-white">Import a form you already have</p>
          <p className="text-xs text-zinc-400">Drop a PDF, Word, Excel or text file here. We turn it into questions you can check before saving.</p>
        </div>
        <input
          ref={input}
          type="file"
          accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.html,.htm,image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) readFile(f) }}
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={() => input.current?.click()} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
            <FileUp className="w-4 h-4" /> {busy ? 'Reading…' : 'Choose file'}
          </button>
          <button onClick={() => setPasteOpen(v => !v)} disabled={busy} className="flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:text-white">
            <ClipboardPaste className="w-4 h-4" /> Paste text
          </button>
        </div>
      </div>
      {pasteOpen && (
        <div className="mt-3 space-y-2">
          <textarea
            value={paste}
            onChange={e => setPaste(e.target.value)}
            rows={8}
            placeholder={'Paste the questions here, one per line. For example:\nName:\nAny injuries? Yes / No\nTraining goals (select all that apply)\n• Strength\n• Speed'}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500"
          />
          <button onClick={readPaste} disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? 'Reading…' : 'Make form'}
          </button>
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-red-400">{msg}</p>}
      {draft && <FormEditor key={draftKey} draft={draft} defaultOpen onClosed={() => setDraft(null)} />}
    </div>
  )
}
