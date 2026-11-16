// Turns the text of a paper/PDF/Word form into PEAC form questions (no AI needed).
import type { Question, QuestionType } from './forms'

export interface FormDraft {
  title: string
  description: string
  questions: Omit<Question, 'id'>[]
}

const BOX = /[☐☑☒□■▢◻◼○●◯◉⬜✓✔]|\[\s?[xX]?\s?\]|\(\s?\)/
const BULLET = /^\s*(?:[☐☑☒□■▢◻◼○●◯◉⬜•·▪‣\-*–]|\[\s?[xX]?\s?\]|\(\s?\)|[a-hA-H][.)]\s)\s*/
const NUMBERED = /^\s*(?:q(?:uestion)?\s*)?\d{1,3}\s*[.):-]\s+/i

function cleanLabel(s: string): string {
  return s
    .replace(NUMBERED, '')
    .replace(/_{2,}.*$/, '')        // "Name: ________"
    .replace(/\.{4,}.*$/, '')       // "Name ........"
    .replace(/\s*\*\s*$/, '')       // required star
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[:\s]+$/, '')
}

function guessType(label: string, options: string[]): QuestionType {
  const l = label.toLowerCase()
  if (options.length) {
    const o = options.map(x => x.toLowerCase())
    if (o.length === 2 && o.includes('yes') && o.includes('no')) return 'yesno'
    if (/select all|check all|all that apply|choose all|mark all/.test(l)) return 'multi'
    return 'choice'
  }
  if (/\b(1\s*[-–to]+\s*10|scale of|rate|rating)\b/.test(l)) return 'scale'
  if (/^(do|does|did|are|is|have|has|were|was|can|will)\b.*\?$/.test(l) && l.length < 90) return 'yesno'
  if (/\b(how many|number of|hours|age\b|weight|height|lbs|kg|inches|minutes|reps|years)\b/.test(l)) return 'number'
  return 'text'
}

/** Splits "☐ Yes ☐ No" or "Yes / No" style inline options */
function inlineOptions(rest: string): string[] {
  if (BOX.test(rest)) {
    return rest.split(new RegExp(BOX.source, 'g')).map(x => x.replace(/[|,;]+$/, '').trim()).filter(Boolean)
  }
  if (/\s\/\s|\s\|\s/.test(rest) && rest.length < 120) {
    const parts = rest.split(/\s[/|]\s/).map(x => x.trim()).filter(Boolean)
    if (parts.length >= 2 && parts.every(p => p.length <= 30)) return parts
  }
  return []
}

const FIELD = /^(your |full |first |last |athlete'?s? )?(name|e-?mail( address)?|phone( number)?|cell|address|date of birth|dob|birthday|school|team|grade|parent|guardian|emergency contact)\b/i

const SKIP = /signature|office use|for staff|initials:?\s*_*$|^page \d+|^step \d+ (of|\/) \d+$|^(back|next|continue|submit)$/i
const SCALE = /\(\s*1\s*[-–]\s*(5|10)\s*\)|scale of|\b1\s*(-|–|to)\s*10\b/i

const looksLikeQuestion = (s: string) =>
  (/\?/.test(s) && s.length < 220) || /\*\s*$/.test(s) || /\((?:[^)]*\b(select|check|choose|circle)\b[^)]*|\s*1\s*[-–]\s*(5|10)\s*)\)/i.test(s) || /:\s*(_{2,}.*)?\*?$/.test(s) || NUMBERED.test(s) || /_{3,}/.test(s) || /\(select all.*\)/i.test(s)

export function parseFormText(raw: string, fallbackTitle = 'Imported form'): FormDraft {
  const lines = raw.replace(/\r/g, '').split('\n').map(l => l.replace(/\t/g, ' ').trimEnd()).filter(l => l.trim())
  const questions: Omit<Question, 'id'>[] = []
  let title = ''
  let description = ''
  let cur: { label: string; options: string[]; required: boolean } | null = null

  const flush = () => {
    if (!cur) return
    const label = cleanLabel(cur.label)
    if (label.length >= 2) {
      const options = Array.from(new Set(cur.options.map(o => o.trim()).filter(o => o && o.length <= 80)))
      const type = guessType(label, options)
      questions.push({ label, type, required: cur.required, ...(type === 'choice' || type === 'multi' ? { options } : {}) })
    }
    cur = null
  }

  for (const line of lines) {
    const t = line.trim()
    if (SKIP.test(t)) { flush(); continue }
    // Option line under the current question
    if (cur && BULLET.test(t) && !NUMBERED.test(t)) {
      const body = t.replace(BULLET, '')
      const many = inlineOptions(t)
      cur.options.push(...(many.length > 1 ? many : [body]))
      continue
    }
    // Question with inline boxes: "Any injuries? ☐ Yes ☐ No"
    const boxAt = t.search(BOX)
    if (boxAt > 3) {
      flush()
      cur = { label: t.slice(0, boxAt), options: inlineOptions(t.slice(boxAt)), required: /\*/.test(t.slice(0, boxAt)) }
      flush()
      continue
    }
    if (looksLikeQuestion(t)) {
      flush()
      // "Label: Option A / Option B"
      const m = t.match(/^(.*?[?:])\s+(.+)$/)
      const opts = m ? inlineOptions(m[2]) : []
      cur = { label: opts.length > 1 && m ? m[1] : t, options: opts.length > 1 ? opts : [], required: /\*\s*$|\(required\)/i.test(t) }
      if (opts.length > 1 || FIELD.test(cleanLabel(t)) || SCALE.test(t)) flush()
      continue
    }
    // Before any question: first short line is the title, the next is the description
    if (!questions.length && !cur && !FIELD.test(cleanLabel(t))) {
      if (!title && t.length <= 80) { title = t; continue }
      if (!description && t.length <= 240 && /[.!]$|\s\w+\s\w+\s\w+\s\w+/.test(t)) { description = t; continue }
    }
    // A short line right after a question with no blanks is probably an option
    if (cur && t.length <= 40 && !/[.!]$/.test(t)) { cur.options.push(t); continue }
    // Otherwise a new line on its own is a new question
    if (!cur && t.length <= 160) {
      cur = { label: t, options: [], required: false }
      if (FIELD.test(cleanLabel(t))) flush()
    }
  }
  flush()

  return { title: title || fallbackTitle, description, questions: questions.slice(0, 80) }
}
