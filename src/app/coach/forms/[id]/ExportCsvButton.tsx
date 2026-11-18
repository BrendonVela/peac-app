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

export function ExportExcelButton({ rows, list, filename }: { rows: (string | number)[][]; list: (string | number)[][]; filename: string }) {
  async function go() {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    // Sheet 1: one line per answer (easy to read and filter)
    const ws1 = XLSX.utils.aoa_to_sheet(list)
    ws1['!cols'] = [{ wch: 22 }, { wch: 26 }, { wch: 20 }, { wch: 4 }, { wch: 50 }, { wch: 50 }]
    ws1['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, list.length - 1), c: 5 } }) }
    XLSX.utils.book_append_sheet(wb, ws1, 'Answers')
    // Sheet 2: one row per person, one column per question (for sorting / comparing)
    const ws2 = XLSX.utils.aoa_to_sheet(rows)
    ws2['!cols'] = rows[0]?.map((_, i) => ({ wch: i < 4 ? 22 : Math.min(36, Math.max(14, ...rows.slice(1).map(r => String(r[i] ?? '').length))) }))
    XLSX.utils.book_append_sheet(wb, ws2, 'Table')
    XLSX.writeFile(wb, filename)
  }
  return (
    <button onClick={go} className={btn}>
      <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
    </button>
  )
}
