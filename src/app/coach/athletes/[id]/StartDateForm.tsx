'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateAssignmentStartDate } from '@/app/actions/schedule'

interface Props {
  assignmentId: string
  athleteId: string
  startDate: string
}

export function StartDateForm({ assignmentId, athleteId, startDate }: Props) {
  const router = useRouter()
  const [date, setDate] = useState(startDate)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function save() {
    setSaving(true)
    setMsg('')
    const res = await updateAssignmentStartDate(assignmentId, athleteId, date)
    setSaving(false)
    if (res && 'error' in res && res.error) {
      setMsg(res.error)
    } else {
      setMsg('Saved')
      router.refresh()
      setTimeout(() => setMsg(''), 2000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500">Week 1 starts</span>
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
      />
      {date !== startDate && (
        <button
          onClick={save}
          disabled={saving}
          className="text-xs px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      )}
      {msg && <span className={`text-xs ${msg === 'Saved' ? 'text-green-400' : 'text-red-400'}`}>{msg}</span>}
    </div>
  )
}
