'use client'

import { useRef, useState } from 'react'
import { Video, Send, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sendVideoMessage } from '@/app/actions/messages'

const MAX_MB = 50
const IDEAS = ['Baseball swing', 'Pitching', 'Squat', 'Deadlift', 'Sprint', 'Jump', 'Golf swing', 'Throw']

/** Paper-clip style button in the message box: record or pick a video, label it, send it */
export function VideoSendButton<M>({ receiverId, onSent }: { receiverId: string; onSent: (msg: M) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    e.target.value = ''
    setErr('')
    if (!f) return
    if (f.size > MAX_MB * 1024 * 1024) {
      setErr(`That video is ${Math.round(f.size / 1024 / 1024)} MB — the limit is ${MAX_MB} MB. Trim it to the part you want looked at.`)
      return
    }
    setFile(f)
  }

  async function send() {
    if (!file) return
    setBusy(true); setErr('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBusy(false); setErr('Please sign in again.'); return }
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4'
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('form-videos').upload(path, file, { contentType: file.type || 'video/mp4', upsert: false })
    if (upErr) { setBusy(false); setErr(`Upload failed: ${upErr.message}`); return }
    const res = await sendVideoMessage(receiverId, path, file.type || 'video/mp4', caption)
    setBusy(false)
    if (!res || 'error' in res) { setErr((res && 'error' in res && res.error) || 'Could not send.'); return }
    onSent(res.message as M)
    setFile(null); setCaption('')
  }

  return (
    <>
      <input ref={input} type="file" accept="video/*" className="hidden" onChange={pick} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="shrink-0 w-10 h-9 flex items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white"
        aria-label="Send a video"
        title="Send a video"
      >
        <Video className="w-4 h-4" />
      </button>
      {(file || err) && (
        <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:absolute sm:inset-x-3 sm:bottom-16 sm:p-0">
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-3 space-y-2 shadow-xl">
            {file && (
              <>
                <p className="text-xs text-zinc-400 truncate">🎥 {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>
                <input
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="What is it? e.g. Baseball swing"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex flex-wrap gap-1.5">
                  {IDEAS.map(i => (
                    <button key={i} type="button" onClick={() => setCaption(i)} className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-white">{i}</button>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-500">Tip: whole body in the frame, phone steady. Side view for swings, lifts and sprints.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={send} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-sm text-white disabled:opacity-50">
                    {busy ? 'Uploading…' : <><Send className="w-4 h-4" /> Send video</>}
                  </button>
                  <button type="button" onClick={() => { setFile(null); setErr('') }} disabled={busy} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-zinc-400 hover:text-white">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              </>
            )}
            {err && (
              <div className="flex items-start gap-2">
                <p className="flex-1 text-xs text-red-400">{err}</p>
                {!file && <button type="button" onClick={() => setErr('')} className="text-zinc-500"><X className="w-4 h-4" /></button>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
