'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'

const FormAnalyzer = dynamic(() => import('./form/FormAnalyzer').then(m => m.FormAnalyzer), { ssr: false })

/** Plays a form-check video stored in Supabase Storage (private link that expires after an hour) */
export function MessageAttachment({ path, type, title = '' }: { path: string; type?: string | null; title?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    let alive = true
    createClient()
      .storage.from('form-videos')
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data) setFailed(true)
        else setUrl(data.signedUrl)
      })
    return () => { alive = false }
  }, [path])

  if (failed) return <p className="mt-2 text-xs opacity-70">Video unavailable (it may have been deleted).</p>
  if (!url) return <div className="mt-2 h-40 w-56 max-w-full rounded-lg bg-black/30 animate-pulse" />
  return (
    <div className="mt-2 space-y-1.5">
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="w-full max-w-xs max-h-80 rounded-lg bg-black"
      >
        {type && <source src={url} type={type} />}
      </video>
      <button
        onClick={e => { e.stopPropagation(); setAnalyzing(true) }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-black/40 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/60"
      >
        🦴 Analyze form
      </button>
      {analyzing && <FormAnalyzer src={url} path={path} title={title} canSave onClose={() => setAnalyzing(false)} />}
    </div>
  )
}
