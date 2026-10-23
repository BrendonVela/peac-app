'use server'

import { createClient } from '@/lib/supabase/server'
import { coachMatch } from '@/lib/acting'
import { importWeeks } from '@/lib/importWeeks'
import type { ParsedWeek } from '@/lib/parseExcelProgram'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'

const TOOL = {
  name: 'save_program',
  description: 'Save the training program found in the document.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Program name, e.g. "Spring Strength Block"' },
      weeks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            phase: { type: 'string', description: 'Phase/block name, or "" if none' },
            week: { type: 'integer', description: 'Week number within the phase, starting at 1' },
            days: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Day name as written, e.g. "MON — Lower Body" or "Day 1"' },
                  warmup: { type: 'array', items: { type: 'string' }, description: 'Warm-up items, one per entry' },
                  exercises: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Exercise name only, no A1/1. prefix' },
                        section: { type: 'string', description: 'Heading it sits under. Exercises done back-to-back must share a section containing "SUPERSET A", "SUPERSET B", etc.' },
                        note: { type: 'string', description: 'Coaching note / tempo / rest, or ""' },
                        sets: {
                          type: 'array',
                          description: 'One entry per set',
                          items: {
                            type: 'object',
                            properties: {
                              weight: { type: 'string', description: 'As written: "135 lb", "75%", "BW", "RPE 8", or ""' },
                              reps: { type: 'string', description: 'As written: "8", "5 ea", "30 sec", "20 yd"' },
                            },
                            required: ['weight', 'reps'],
                          },
                        },
                      },
                      required: ['name', 'sets'],
                    },
                  },
                },
                required: ['title', 'exercises'],
              },
            },
          },
          required: ['week', 'days'],
        },
      },
    },
    required: ['title', 'weeks'],
  },
}

const INSTRUCTIONS = `You are reading a strength & conditioning program (a PDF, a spreadsheet printout, or a photo of a whiteboard or paper).
Call save_program with every week, day and exercise exactly as written. Rules:
- If weeks are shown side by side as columns (Week 1 | Week 2 | ...), output each as its own week with that week's numbers.
- If only one week is written, output one week.
- One entry in "sets" per set. "4x8 @ 135" means four sets of {weight:"135 lb", reps:"8"}.
- Keep weights as written; add "lb" to bare numbers. Percentages stay as "75%".
- Exercises paired as A1/A2 or listed as a superset/circuit share one section named like "SUPERSET A".
- Put warm-up / mobility prep lines in "warmup", not exercises.
- Do not invent exercises or numbers. If something is unreadable, skip it.`

interface AiProgram {
  title: string
  weeks: { phase?: string; week: number; days: { title: string; warmup?: string[]; exercises: { name: string; section?: string; note?: string; sets: { weight: string; reps: string }[] }[] }[] }[]
}

function toParsed(p: AiProgram): ParsedWeek[] {
  return (p.weeks ?? []).map((w, i) => ({
    phaseTitle: (w.phase || p.title || 'Program').trim(),
    refMaxes: {},
    localWeek: w.week || i + 1,
    absoluteWeek: i + 1,
    days: (w.days ?? [])
      .map(d => ({
        title: (d.title || `Day`).trim(),
        warmup: d.warmup && d.warmup.length ? { title: 'Warm-up', items: d.warmup.map(s => s.trim()).filter(Boolean) } : null,
        exercises: (d.exercises ?? [])
          .filter(e => e.name?.trim() && e.sets?.length)
          .map(e => ({
            name: e.name.trim(),
            section: e.section?.trim() || null,
            coachingNote: e.note?.trim() || null,
            sets: e.sets.map((s, k) => ({ setLabel: `Set ${k + 1}`, prescWt: s.weight?.trim() || null, prescReps: s.reps?.trim() || null })),
          })),
      }))
      .filter(d => d.exercises.length > 0),
  })).filter(w => w.days.length > 0)
}

export async function importProgramFromDocument(formData: FormData): Promise<{ id?: string; error?: string }> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { error: 'PDF/photo import is not set up yet (missing ANTHROPIC_API_KEY on the server).' }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { data: coach } = await supabase.from('coaches').select('id').match(await coachMatch(supabase, user.id)).maybeSingle()
  if (!coach) return { error: 'Coach profile not found' }

  const file = formData.get('file') as File | null
  if (!file) return { error: 'No file uploaded' }
  const type = file.type || ''
  const isPdf = type === 'application/pdf' || /\.pdf$/i.test(file.name)
  const isImage = /^image\/(jpeg|png|webp|gif)$/.test(type)
  if (!isPdf && !isImage) return { error: 'Use a PDF, or a JPG/PNG photo.' }
  if (file.size > 4.4 * 1024 * 1024) return { error: 'That file is over 4 MB. Try a smaller PDF or photo.' }

  const data = Buffer.from(await file.arrayBuffer()).toString('base64')
  const block = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
    : { type: 'image', source: { type: 'base64', media_type: type, data } }

  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'save_program' },
        messages: [{ role: 'user', content: [block, { type: 'text', text: INSTRUCTIONS }] }],
      }),
    })
  } catch (e) {
    return { error: `Could not reach the AI service: ${(e as Error).message}` }
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    console.error('[import-doc] AI error', res.status, txt.slice(0, 500))
    return { error: res.status === 401 ? 'The AI key is not valid. Check ANTHROPIC_API_KEY in Vercel.' : `The AI service returned an error (${res.status}). Try again.` }
  }
  const json = await res.json()
  const tool = (json.content ?? []).find((c: any) => c.type === 'tool_use')
  if (!tool?.input) return { error: 'Could not read a program from that file.' }
  if (json.stop_reason === 'max_tokens') console.warn('[import-doc] output cut off — program may be incomplete')

  const program = tool.input as AiProgram
  const weeks = toParsed(program)
  if (weeks.length === 0) return { error: 'No workouts found in that file. Try a clearer photo or a PDF.' }

  const base = (program.title || file.name.replace(/\.[^.]+$/, '')).trim()
  const id = await importWeeks(supabase, coach.id, weeks, base, `Imported from ${isPdf ? 'PDF' : 'photo'} — check it over`)
  return { id }
}
