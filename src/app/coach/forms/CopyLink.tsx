'use client'

import { useState } from 'react'
import { Link2, Check } from 'lucide-react'
import { publicFormUrl } from '@/lib/forms'

export function CopyLink({ slug }: { slug: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    const url = publicFormUrl(slug)
    try {
      if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) { await navigator.share({ url }); return }
      await navigator.clipboard.writeText(url)
      setDone(true); setTimeout(() => setDone(false), 2000)
    } catch { /* closed the share sheet */ }
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-200 hover:text-white">
      {done ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />} {done ? 'Copied' : 'Public link'}
    </button>
  )
}
