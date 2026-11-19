'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { excelImportStart, excelImportWeeks, excelImportFinish } from '@/app/actions/importProgram'

const CHUNK = 2 // weeks saved per step

export function ImportExcel() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pct, setPct] = useState(0)
  const [label, setLabel] = useState('')
  const creep = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopCreep() { if (creep.current) clearInterval(creep.current); creep.current = null }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true); setError(''); setPct(2); setLabel('Reading your file…')
    // While the file is read and exercises are matched, ease the bar toward 15%
    creep.current = setInterval(() => setPct(p => (p < 15 ? p + 0.5 : p)), 200)
    let programId: string | null = null
    try {
      const start = await excelImportStart(new FormData(e.currentTarget))
      stopCreep()
      if ('error' in start) { setError(start.error); setBusy(false); return }
      programId = start.programId
      const { weeks, nameToId } = start
      let workouts = 0
      let firstError: string | null = null
      for (let i = 0; i < weeks.length; i += CHUNK) {
        const part = weeks.slice(i, i + CHUNK)
        const last = Math.min(i + CHUNK, weeks.length)
        setLabel(`Saving week ${last} of ${weeks.length}…`)
        const res = await excelImportWeeks(programId, part, nameToId)
        if ('error' in res && res.error) { firstError ??= res.error; continue }
        if ('workouts' in res) { workouts += res.workouts; firstError ??= res.firstError }
        setPct(15 + Math.round((last / weeks.length) * 80))
      }
      setLabel('Finishing up…')
      const done = await excelImportFinish(programId, workouts, firstError)
      if ('error' in done && done.error) { setError(done.error); setBusy(false); setPct(0); return }
      setPct(100); setLabel(`Done! ${workouts} workouts imported.`)
      router.push(`/coach/programs/${programId}`)
    } catch {
      stopCreep()
      if (programId) await excelImportFinish(programId, 0, 'the connection dropped').catch(() => {})
      setError('The import didn’t finish. The file may be too big (over 5 MB) or the connection dropped. Try again.')
      setBusy(false); setPct(0)
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3 bg-panel border border-line rounded-2xl px-4 py-3">
        <Upload className="w-4 h-4 text-zinc-400 shrink-0" />
        <input
          type="file"
          name="file"
          accept=".xlsx,.xls"
          required
          disabled={busy}
          onChange={() => setError('')}
          className="flex-1 min-w-0 text-sm text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-blue-600 file:text-white file:text-sm file:font-medium file:cursor-pointer hover:file:bg-blue-700"
        />
        <Button type="submit" size="sm" variant="secondary" loading={busy}>
          {busy ? 'Importing…' : 'Import'}
        </Button>
        {busy && (
          <div className="basis-full space-y-1.5" role="status" aria-live="polite">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-zinc-300">
                {pct >= 100 && <CheckCircle2 className="w-3.5 h-3.5 text-volt" />} {label}
              </span>
              <span className="font-semibold text-white">{Math.round(pct)}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-panel2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
              <div className={`h-full rounded-full transition-all duration-300 ${pct >= 100 ? 'bg-volt' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </form>
      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-red-600/30 bg-red-600/10 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
