'use client'

import { useRef, useState } from 'react'
import { Video, Send, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sendFormVideo } from '@/app/actions/messages'

const MAX_MB = 50

export function FormVideoButton({ exerciseTitle }: { exerciseTitle: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    e.target.value = ''
    setMsg(null)
    if (!f) return
    if (f.size > MAX_MB * 1024 * 1024) {
      setMsg({ t: `That video is ${Math.round(f.size / 1024 / 1024)} MB — the limit is ${MAX_MB} MB. Trim it to one set (about 20–30 seconds) and try again.`, ok: false })
      return
    }
    setFile(f)
  }

  async function send() {
    if (!file) return
    setBusy(true); setMsg(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBusy(false); setMsg({ t: 'Please sign in again.', ok: false }); return }
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4'
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('form-videos').upload(path, file, {
      contentType: file.type || 'video/mp4',
      upsert: false,
    })
    if (upErr) { setBusy(false); setMsg({ t: `Upload failed: ${upErr.message}`, ok: false }); return }
    const res = await sendFormVideo(path, file.type || 'video/mp4', exerciseTitle, note)
    setBusy(false)
    if (res && 'error' in res && res.error) { setMsg({ t: res.error, ok: false }); return }
    setFile(null); setNote('')
    setMsg({ t: 'Sent to your coach ✓', ok: true })
    setTimeout(() => setMsg(null), 4000)
  }

  return (
    <>
      <input ref={input} type="file" accept="video/*" className="hidden" onChange={pick} />
      <button
        onClick={() => input.current?.click()}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-400 hover:text-white hover:border-zinc-600 whitespace-nowrap"
        title="Film a set and send it to your coach"
      >
        <Video className="w-4 h-4" /> Form check
      </button>
      {(file || msg) && (
        <div className="basis-full space-y-2">
          {file && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 space-y-2">
              <p className="text-xs text-zinc-400 truncate">🎥 {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Question for your coach? (optional)"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button onClick={send} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-sm text-white disabled:opacity-50">
                  {busy ? 'Uploading…' : <><Send className="w-4 h-4" /> Send to coach</>}
                </button>
                <button onClick={() => setFile(null)} disabled={busy} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            </div>
          )}
          {msg && <p className={`flex items-center gap-1 text-xs ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.ok && <Check className="w-3.5 h-3.5" />}{msg.t}</p>}
        </div>
      )}
    </>
  )
}
