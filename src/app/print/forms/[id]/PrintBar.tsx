'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export function PrintBar({ title, count, backHref }: { title: string; count: number; backHref: string }) {
  useEffect(() => {
    document.title = title // becomes the PDF's file name
    if (count > 0) {
      const t = setTimeout(() => window.print(), 600)
      return () => clearTimeout(t)
    }
  }, [title, count])

  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-6 py-3">
      <Link href={backHref} className="text-sm font-medium text-blue-700">← Back</Link>
      <p className="flex-1 text-sm text-zinc-600">In the print window, choose <b>Save as PDF</b> as the printer.</p>
      <button onClick={() => window.print()} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">Save as PDF</button>
    </div>
  )
}
