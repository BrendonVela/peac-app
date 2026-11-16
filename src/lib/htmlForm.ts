// Reads a web page's form (labels, buttons, checkboxes, dropdowns, text boxes) into PEAC questions
import { parse, type HTMLElement } from 'node-html-parser'
import type { FormDraft } from './formParse'
import type { Question, QuestionType } from './forms'

const SKIP_TAGS = new Set(['script', 'style', 'svg', 'noscript', 'template', 'head', 'iframe'])
const INLINE = new Set(['span', 'strong', 'b', 'em', 'i', 'small', 'br', 'sup', 'sub', 'u', 'mark', 'abbr', 'img'])
const NAV_WORDS = /^(continue|next|back|previous|submit|send|download pdf|download|start over|new assessment|reset|cancel|close|←|→)\b/i
const NOISE = /is required|enter a valid|please (select|enter|choose)|^select your|^step \d+ of \d+$|takes under|^required$/i
const NAVISH = /\b(step|progress|nav|tab|stepper|breadcrumb|footer|header|toolbar)\b/i

const EMOJI_START = new RegExp('^[\\p{Extended_Pictographic}\\uFE0F\\u200D\\s]+', 'u')
const clean = (s: string) => s.replace(/\s+/g, ' ').replace(EMOJI_START, '').trim()


/** Text of an element; separate lines inside it become "A – B" (e.g. "Beginner – Under 1 year") */
function textOf(el: HTMLElement): string {
  return el.structuredText.split('\n').map(clean).filter(Boolean).join(' – ')
}

type Block =
  | { kind: 'text'; text: string }
  | { kind: 'options'; items: string[]; multi: boolean }
  | { kind: 'field'; type: QuestionType; label?: string }

const elementKids = (el: HTMLElement) => el.childNodes.filter((n): n is HTMLElement => n.nodeType === 1 && !SKIP_TAGS.has((n as HTMLElement).tagName?.toLowerCase()))

function isOptionGroup(el: HTMLElement): { items: string[]; multi: boolean } | null {
  const kids = elementKids(el)
  if (kids.length < 2 || kids.length > 40) return null
  if (NAVISH.test(`${el.getAttribute('class') ?? ''} ${el.id ?? ''}`)) return null
  // Answer lists are runs of look-alike items: same tag and same class (chips, buttons, labels...)
  const answerKids = kids.filter(k => k.tagName.toLowerCase() !== 'input')
  const sig = (k: HTMLElement) => `${k.tagName.toLowerCase()}.${(k.getAttribute('class') ?? '').replace(/\b(active|selected|on|checked|is-\w+)\b/g, '').trim()}`
  if (new Set(answerKids.map(sig)).size > 1) return null
  if (answerKids.some(k => k.querySelector('select, textarea'))) return null
  const items: string[] = []
  for (const k of kids) {
    if (/^(input)$/i.test(k.tagName)) continue
    const t = textOf(k)
    if (!t || t.length > 90 || NAV_WORDS.test(t)) return null
    // a child that is itself a group or holds a text box means this isn't a list of answers
    if (k.querySelector('textarea, select, input[type=text], input[type=email], input[type=number]')) return null
    if (elementKids(k).some(g => elementKids(g).length >= 3)) return null
    items.push(t)
  }
  if (items.length < 2) return null
  // "1 You 2 Training 3 Goals" style step bars
  if (items.every(t => /^\d+\s*[–-]?\s*\S*$/.test(t)) && items.length <= 8 && items.some(t => /\D/.test(t))) return null
  const html = el.outerHTML.toLowerCase()
  const multi = /type=["']?checkbox/.test(html) || /\b(multi|checkbox|check-?list)\b/.test(el.getAttribute('class') ?? '')
  return { items, multi }
}

function walk(el: HTMLElement, out: Block[]) {
  const tag = el.tagName?.toLowerCase()
  if (!tag || SKIP_TAGS.has(tag)) return
  if (tag === 'button' || tag === 'a') return // stray buttons/links outside answer lists
  if (tag === 'select') {
    const items = el.querySelectorAll('option').map(o => clean(o.text)).filter(t => t && !/^(select|choose|--)/i.test(t))
    if (items.length >= 2) out.push({ kind: 'options', items, multi: el.hasAttribute('multiple') })
    return
  }
  if (tag === 'textarea') { out.push({ kind: 'field', type: 'text' }); return }
  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase()
    if (type === 'range') {
      const max = Number(el.getAttribute('max') ?? 10)
      out.push({ kind: 'field', type: max <= 10 ? 'scale' : 'number' })
    } else if (['text', 'email', 'tel', 'date', 'search', 'url'].includes(type)) {
      out.push({ kind: 'field', type: 'text' })
    } else if (type === 'number') {
      out.push({ kind: 'field', type: 'number' })
    }
    return
  }
  const group = isOptionGroup(el)
  if (group) { out.push({ kind: 'options', ...group }); return }

  const kids = elementKids(el)
  const leaf = kids.every(k => INLINE.has(k.tagName.toLowerCase()))
  if (leaf) {
    const t = textOf(el)
    if (t) out.push({ kind: 'text', text: t })
    return
  }
  // mixed content: loose text next to child elements
  for (const n of el.childNodes) {
    if (n.nodeType === 3) {
      const t = clean(n.text)
      if (t) out.push({ kind: 'text', text: t })
    } else if (n.nodeType === 1) {
      walk(n as HTMLElement, out)
    }
  }
}

export function parseHtmlForm(html: string): FormDraft {
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false, noscript: false, pre: true } })
  const body = root.querySelector('body') ?? root
  const blocks: Block[] = []
  walk(body, blocks)

  const pageTitle = clean(root.querySelector('title')?.text ?? '')
  const h1 = clean(root.querySelector('h1')?.text ?? '')
  const questions: Omit<Question, 'id'>[] = []
  let label: string | null = null
  const seen = new Set<string>()

  const add = (raw: string, type: QuestionType, options?: string[]) => {
    const required = /\*\s*$/.test(raw) || /\(required\)/i.test(raw)
    const l = raw.replace(/\s*\*\s*$/, '').replace(/\(required\)/i, '').replace(/[:\s]+$/, '').trim()
    if (!l || seen.has(l.toLowerCase())) return
    seen.add(l.toLowerCase())
    let t = type
    if (t === 'choice' && /select all|check all|all that apply|choose all/i.test(l)) t = 'multi'
    if (options && options.length === 2 && options.every(o => /^(yes|no)$/i.test(o))) t = 'yesno'
    if (t === 'text' && /\b(how many|number of|age\b|weight|height|hours)\b/i.test(l) && !/range/i.test(l)) t = 'number'
    questions.push({ label: l.replace(/\s*\((select|check) all that apply\)/i, ''), type: t, required, ...(t === 'choice' || t === 'multi' ? { options } : {}) })
  }

  for (const b of blocks) {
    if (b.kind === 'text') {
      if (NOISE.test(b.text) || NAV_WORDS.test(b.text) || b.text.length > 160 || /^\d+$/.test(b.text)) continue
      label = b.text
    } else if (b.kind === 'options') {
      if (label) add(label, b.multi ? 'multi' : 'choice', b.items)
      label = null
    } else if (b.kind === 'field') {
      if (label) add(label, b.type)
      label = null
    }
  }

  return {
    title: (h1 && pageTitle.includes(h1) ? pageTitle : pageTitle || h1 || 'Imported form').replace(/\s+[—|-]\s+/g, ' – ').slice(0, 120),
    description: '',
    questions,
  }
}
