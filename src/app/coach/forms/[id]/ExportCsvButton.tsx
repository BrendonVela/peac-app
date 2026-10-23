'use client'

import { Download } from 'lucide-react'

export function ExportCsvButton({ rows, filename }: { rows: (string | number)[][]; filename: string }) {
  function go() {
    const csv = rows.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <button onClick={go} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:text-white">
      <Download className="w-3.5 h-3.5" /> Export CSV
    </button>
  )
}
