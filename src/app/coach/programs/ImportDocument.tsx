'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Sparkles } from 'lucide-react'
import { importProgramFromDocument } from '@/app/actions/importDocument'

/** Shrink big phone photos before sending (keeps the upload small and fast) */
async function shrinkImage(file: File, max = 2000): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob: Blob = await new Promise(r => canvas.toBlob(b => r(b!), 'image/jpeg', 0.85))
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export function ImportDocument() {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true); setMsg('')
    const file = await shrinkImage(f)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await importProgramFromDocument(fd)
      if (res.error) { setMsg(res.error); setBusy(false); return }
      router.push(`/coach/programs/${res.id}?edit=1`)
    } catch {
      setMsg('That took too long or the file was too big. Try a smaller file, or split the program into parts.')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-violet-600/30 bg-violet-600/5 px-4 py-3">
      <Sparkles className="w-4 h-4 text-violet-300 shrink-0" />
      <div className="flex-1 min-w-[12rem]">
        <p className="text-sm text-white">Import from a PDF or photo</p>
        <p className="text-xs text-zinc-400">AI reads a PDF, printout or whiteboard photo and builds the program. Always check it over after.</p>
      </div>
      <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} />
      <button
        onClick={() => input.current?.click()}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        <FileText className="w-4 h-4" /> {busy ? 'Reading… (1–3 min)' : 'Choose PDF or photo'}
      </button>
      {msg && <p className="basis-full text-xs text-red-400">{msg}</p>}
    </div>
  )
}
