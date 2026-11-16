'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { CLIPS, type ClipKey } from '@/lib/media'

const OVERLAYS = {
  bottom: 'bg-gradient-to-b from-ink/30 via-ink/60 to-ink',
  card: 'bg-gradient-to-b from-ink/10 via-ink/50 to-ink/95',
  left: 'bg-gradient-to-r from-ink/95 via-ink/65 to-ink/25',
  full: 'bg-ink/70',
}

/**
 * Looping, silent background video behind a hero section.
 * Falls back to a slow-moving color background when there's no clip,
 * the phone is on data saver, or the person prefers less motion.
 */
export function VideoBackground({ clip, overlay = 'bottom', className }: {
  clip: ClipKey
  overlay?: keyof typeof OVERLAYS
  className?: string
}) {
  const src = CLIPS[clip]
  const ref = useRef<HTMLVideoElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!src) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saver = (navigator as any).connection?.saveData
    if (reduce || saver) return
    setShow(true)
  }, [src])

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true // iPhone only autoplays muted video
    v.play().catch(() => {})
  }, [show])

  return (
    <div aria-hidden="true" className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      <div className="peac-aurora absolute inset-0" />
      <div className="peac-lines absolute inset-0" />
      {show && src && (
        <video
          ref={ref}
          className="peac-video absolute inset-0 w-full h-full object-cover"
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setShow(false)}
        />
      )}
      <div className={cn('absolute inset-0', OVERLAYS[overlay])} />
    </div>
  )
}
