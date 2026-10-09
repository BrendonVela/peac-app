'use client'

import { useState } from 'react'
import { Play, VideoOff, X } from 'lucide-react'

function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|studio\.youtube\.com\/video\/)([a-zA-Z0-9_-]{11})/
  )
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

export function ExerciseVideo({ url, title }: { url?: string | null; title?: string }) {
  const [open, setOpen] = useState(false)

  if (!url) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-400 mt-1.5">
        <VideoOff className="w-3 h-3" />
        No video
      </span>
    )
  }

  const embed = getYouTubeEmbedUrl(url)

  // Not a YouTube link: open it in a new tab instead
  if (!embed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-1.5 w-fit"
      >
        <Play className="w-3 h-3" />
        Watch demo
      </a>
    )
  }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
      >
        {open ? <X className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        {open ? 'Hide demo' : 'Watch demo'}
      </button>

      {open && (
        <div className="mt-2 aspect-video w-full max-w-md overflow-hidden rounded-lg">
          <iframe
            src={embed}
            title={`${title ?? 'Exercise'} demo`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  )
}