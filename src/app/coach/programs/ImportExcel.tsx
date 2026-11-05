'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { importProgramFromExcel } from '@/app/actions/importProgram'

export function ImportExcel() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const res = await importProgramFromExcel(new FormData(e.currentTarget))
      if (res.error || !res.id) { setError(res.error || 'Import failed.'); setBusy(false); return }
      router.push(`/coach/programs/${res.id}`)
    } catch {
      setError('The import didn’t finish — the file may be too big (over 5 MB) or the connection dropped. Try again, or split the file into smaller parts.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
        <Upload className="w-4 h-4 text-zinc-400 shrink-0" />
        <input
          type="file"
          name="file"
          accept=".xlsx,.xls"
          required
          onChange={() => setError('')}
          className="flex-1 min-w-0 text-sm text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-blue-600 file:text-white file:text-sm file:font-medium file:cursor-pointer hover:file:bg-blue-700"
        />
        <Button type="submit" size="sm" variant="secondary" loading={busy}>
          {busy ? 'Importing…' : 'Import'}
        </Button>
      </form>
      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-red-600/30 bg-red-600/10 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
