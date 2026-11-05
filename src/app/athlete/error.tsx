'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

/** Shown instead of a blank error page if something on this screen breaks */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="mx-auto max-w-md py-20 text-center space-y-4">
      <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
      <h1 className="text-xl font-bold text-white">Something went wrong</h1>
      <p className="text-sm text-zinc-400">This screen hit a problem. Your data is safe. Try again, and if it keeps happening, send a screenshot of this to the PEAC admin.</p>
      {error.digest && <p className="text-[11px] text-zinc-600">Code: {error.digest}</p>}
      <div className="flex justify-center gap-3">
        <button onClick={reset} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Try again</button>
        <Link href="/athlete" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300">Home</Link>
      </div>
    </div>
  )
}
