'use server'

import { createClient } from '@/lib/supabase/server'
import { parseFormText, type FormDraft } from '@/lib/formParse'
import { pdfToLines } from '@/lib/pdfLines'
import type { QuestionType } from '@/lib/forms'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'
const TYPES: QuestionType[] = ['scale', 'yesno', 'text', 'number', 'choice', 'multi']

type Result = { draft: FormDraft } | { error: string }

async function signedIn() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return !!user && user.user_metadata?.role !== 'athlete'
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/label|\/option)>/gi, '\n')
    .replace(/<option[^>]*>/gi, '\n• ')
    .replace(/<input[^>]*type=["']?(checkbox|radio)[^>]*>/gi, '☐ ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
}

function finish(d: FormDraft, name: string): Result {
  const fallback = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Imported form'
  const questions = d.questions
    .filter(q => q.label && TYPES.includes(q.type))
    .map(q => ({ ...q, label: q.label.slice(0, 300), options: q.options?.filter(Boolean).slice(0, 40) }))
  if (questions.length === 0) {
    return { error: "Couldn't find any questions in that file. Try copying the questions and using Paste text instead." }
  }
  return { draft: { title: (d.title || fallback).slice(0, 120), description: (d.description || '').slice(0, 300), questions } }
}

/** Optional: if an AI key is set up, use it for photos and messy PDFs */
async function aiRead(block: object): Promise<FormDraft | null> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        tools: [{
          name: 'save_form',
          description: 'Save the questionnaire found in the document',
          input_schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    type: { type: 'string', enum: TYPES, description: 'scale = 1-10 rating, yesno, text, number, choice = pick one, multi = pick all that apply' },
                    options: { type: 'array', items: { type: 'string' } },
                    required: { type: 'boolean' },
                  },
                  required: ['label', 'type'],
                },
              },
            },
            required: ['title', 'questions'],
          },
        }],
        tool_choice: { type: 'tool', name: 'save_form' },
        messages: [{ role: 'user', content: [block, { type: 'text', text: 'This is a form or questionnaire for athletes. List every question in order with the best answer type and all answer options word for word. Skip signature lines and office-use-only boxes.' }] }],
      }),
    })
    if (!res.ok) return null
    const json = await res.json()
    const tool = (json.content ?? []).find((c: { type: string }) => c.type === 'tool_use')
    return (tool?.input as FormDraft) ?? null
  } catch {
    return null
  }
}

export async function parseFormFile(formData: FormData): Promise<Result> {
  if (!(await signedIn())) return { error: 'Not signed in as a coach' }
  const file = formData.get('file') as File | null
  if (!file) return { error: 'No file uploaded' }
  if (file.size > 4.4 * 1024 * 1024) return { error: 'That file is over 4 MB. Try a smaller file.' }
  const name = file.name || 'form'
  const type = file.type || ''
  const buf = Buffer.from(await file.arrayBuffer())

  try {
    // PDF
    if (type === 'application/pdf' || /\.pdf$/i.test(name)) {
      const ai = await aiRead({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } })
      if (ai) return finish(ai, name)
      return finish(parseFormText(await pdfToLines(new Uint8Array(buf))), name)
    }
    // Photo
    if (/^image\//.test(type)) {
      const ai = await aiRead({ type: 'image', source: { type: 'base64', media_type: type, data: buf.toString('base64') } })
      if (ai) return finish(ai, name)
      return { error: 'Reading photos needs the AI add-on. Use a PDF or Word file, or paste the questions as text.' }
    }
    // Word
    if (/\.docx$/i.test(name) || type.includes('wordprocessingml')) {
      const mammoth = await import('mammoth')
      const { value } = await mammoth.extractRawText({ buffer: buf })
      return finish(parseFormText(value), name)
    }
    // Excel / CSV: one question per row (column A = question, other columns = options)
    if (/\.(xlsx|xls|csv)$/i.test(name)) {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(buf, { type: 'buffer' })
      const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false })
      const text = rows
        .map(r => (r ?? []).map(c => String(c ?? '').trim()).filter(Boolean))
        .filter(r => r.length)
        .map(r => (r.length > 1 ? `${r[0]}${/[?:]$/.test(r[0]) ? '' : ':'}\n${r.slice(1).map(o => `• ${o}`).join('\n')}` : `${r[0]}${/[?:]$/.test(r[0]) ? '' : ':'}`))
        .join('\n')
      return finish(parseFormText(text), name)
    }
    // Web page or plain text
    if (/\.html?$/i.test(name) || type === 'text/html') return finish(parseFormText(htmlToText(buf.toString('utf8'))), name)
    if (/\.(txt|md)$/i.test(name) || type.startsWith('text/')) return finish(parseFormText(buf.toString('utf8')), name)
  } catch (e) {
    console.error('[form-import]', e)
    return { error: "Couldn't read that file. Try saving it as a PDF, or paste the questions as text." }
  }
  return { error: 'Use a PDF, Word (.docx), Excel/CSV, or text file.' }
}

export async function parseFormPaste(text: string): Promise<Result> {
  if (!(await signedIn())) return { error: 'Not signed in as a coach' }
  if (!text.trim()) return { error: 'Paste the questions first.' }
  return finish(parseFormText(text.slice(0, 50000)), 'Pasted form')
}
