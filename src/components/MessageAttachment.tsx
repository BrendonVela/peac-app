'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/** Plays a form-check video stored in Supabase Storage (private link that expires after an hour) */
export function MessageAttachment({ path, type }: { path: string; type?: string | null }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

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
    <video
      src={url}
      controls
      playsInline
      preload="metadata"
      className="mt-2 w-full max-w-xs max-h-80 rounded-lg bg-black"
    >
      {type && <source src={url} type={type} />}
    </video>
  )
}
