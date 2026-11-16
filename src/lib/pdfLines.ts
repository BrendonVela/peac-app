// Reads a PDF's text line by line (keeps the layout's line breaks, which the form reader needs)
export async function pdfToLines(data: Uint8Array): Promise<string> {
  const { getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(data)
  const out: string[] = []
  for (let p = 1; p <= Math.min(pdf.numPages, 30); p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const rows = new Map<number, { x: number; s: string }[]>()
    for (const it of content.items as { str?: string; transform?: number[] }[]) {
      if (typeof it.str !== 'string' || !it.transform) continue
      const y = Math.round(it.transform[5] / 4) * 4 // items within a few points share a line
      const list = rows.get(y) ?? []
      list.push({ x: it.transform[4], s: it.str })
      rows.set(y, list)
    }
    Array.from(rows.keys()).sort((a, b) => b - a).forEach(y => {
      const line = rows.get(y)!.sort((a, b) => a.x - b.x).map(i => i.s).join(' ').replace(/\s+/g, ' ').trim()
      if (line) out.push(line)
    })
  }
  return out.join('\n')
}
