'use client'

import { Download, FileSpreadsheet } from 'lucide-react'

const btn = 'flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:text-white'

export function ExportCsvButton({ rows, filename }: { rows: (string | number)[][]; filename: string }) {
  function go() {
    const csv = rows.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }))
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <button onClick={go} className={btn}>
      <Download className="w-3.5 h-3.5" /> CSV
    </button>
  )
}

export function ExportExcelButton({ rows, filename, sheet }: { rows: (string | number)[][]; filename: string; sheet: string }) {
  async function go() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = rows[0]?.map((_, i) => ({ wch: Math.min(40, Math.max(12, ...rows.map(r => String(r[i] ?? '').length))) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheet.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Responses')
    XLSX.writeFile(wb, filename)
  }
  return (
    <button onClick={go} className={btn}>
      <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
    </button>
  )
}
