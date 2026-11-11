'use server'
// Answers for the voice coach. Everything is read with the athlete's own permissions
// (the leaderboard uses the same server-only lookup as the Leaderboard page).

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { athleteMatch } from '@/lib/acting'
import { getAthleteSchedule, addDays, formatShortDate, todayISO, type ScheduledWorkout } from '@/lib/schedule'
import { getLiftHistory } from '@/lib/liftHistory'
import { LIFTS, type LiftKey } from '@/lib/maxes'
import { loadTestDefs } from '@/lib/tests'
import { getTeamBoard } from '@/lib/leaderboard'
import { getMyForms } from '@/lib/dueForms'
import { rescheduleWorkout } from './schedule'

async function me() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, name, coach_id, coaches(user_id, name)')
    .match(await athleteMatch(supabase, user.id))
    .maybeSingle()
  if (!athlete) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coach = (athlete as any).coaches as { user_id: string | null; name: string } | null
  return { supabase, user, athlete: athlete as { id: string; name: string; coach_id: string | null }, coach }
}

const first = (name: string) => (name || '').trim().split(/\s+/)[0] || 'there'
const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th'}`
const dayName = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long' })

/** The workout to do now: today's unfinished one, else the next upcoming one this week */
function pickWorkout(items: ScheduledWorkout[], today: string) {
  const open = items.filter(i => i.status !== 'done')
  const todays = open.filter(i => i.plannedDate === today).sort((a, b) => a.dayNumber - b.dayNumber)
  if (todays.length) return { w: todays[0], when: 'today' as const }
  const upcoming = open.filter(i => i.plannedDate > today).sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
  if (upcoming.length) return { w: upcoming[0], when: 'later' as const }
  return null
}

export async function voiceWelcome() {
  const ctx = await me()
  if (!ctx) return { text: '' }
  const s = await getAthleteSchedule(ctx.supabase, ctx.athlete.id)
  const p = pickWorkout(s.items, s.today)
  const hi = `Welcome back, ${first(ctx.athlete.name)}.`
  if (p?.when === 'today') {
    return { text: `${hi} Today you've got ${p.w.title}, ${p.w.exerciseCount} exercises. Let me know when you want to get started. Just say "let's go".`, workoutId: p.w.workoutId }
  }
  if (p) return { text: `${hi} Nothing scheduled today. Your next workout is ${p.w.title} on ${dayName(p.w.plannedDate)}. Tap the mic any time if you need me.`, workoutId: p.w.workoutId }
  return { text: `${hi} You don't have a workout scheduled right now. Tap the mic any time if you need me.` }
}

export async function voiceToday() {
  const ctx = await me()
  if (!ctx) return { text: 'Please sign in again.' }
  const s = await getAthleteSchedule(ctx.supabase, ctx.athlete.id)
  const p = pickWorkout(s.items, s.today)
  if (!p) return { text: "You don't have any workouts left this week. Nice work." }
  if (p.when === 'today') return { text: `Today is ${p.w.title}, ${p.w.exerciseCount} exercises${p.w.doneCount ? `, ${p.w.doneCount} already done` : ''}. Say "let's go" to start.`, workoutId: p.w.workoutId }
  return { text: `Nothing today. Next up is ${p.w.title} on ${dayName(p.w.plannedDate)}. Say "let's go" if you want to do it now.`, workoutId: p.w.workoutId }
}

const LIFT_WORDS: [RegExp, LiftKey][] = [
  [/squat/, 'squat'], [/dead ?lift|trap ?bar|\bdl\b|hex/, 'trap_bar_dl'], [/bench|press/, 'db_bench'], [/row/, 'pendlay_row'],
]
const TEST_WORDS: [RegExp, string][] = [
  [/\b10\b|ten yard/, '10_yard'], [/\b20\b|twenty yard/, '20_yard'], [/\b40\b|forty|dash/, '40_yard'],
  [/vert/, 'vertical_jump'], [/broad|long jump/, 'broad_jump'], [/pro agility|5 10 5|shuttle/, 'pro_agility'], [/body ?weight|weigh/, 'body_weight'],
]

export async function voiceStat(what: string) {
  const ctx = await me()
  if (!ctx) return { text: 'Please sign in again.' }
  const q = what.toLowerCase()
  const lift = LIFT_WORDS.find(([re]) => re.test(q))?.[1]
  if (lift) {
    const hist = await getLiftHistory(ctx.supabase, ctx.athlete.id)
    const h = hist.find(x => x.lift === lift)
    const label = LIFTS.find(l => l.key === lift)?.label ?? 'that lift'
    const per = lift === 'db_bench' ? ' per dumbbell' : ''
    const parts: string[] = []
    if (h?.savedMax) parts.push(`Your ${label} max is ${h.savedMax} pounds${per}.`)
    if (h?.best) parts.push(`Your best estimated max from training is ${h.best.e1rm}${per}, from ${h.best.weight} for ${h.best.reps} on ${formatShortDate(h.best.date)}.`)
    if (h?.newPR) parts.push('And that was a new PR last time. Nice.')
    return { text: parts.length ? parts.join(' ') : `I don't have any ${label} numbers for you yet.` }
  }
  const defs = await loadTestDefs(ctx.supabase, ctx.athlete.coach_id)
  const key = TEST_WORDS.find(([re]) => re.test(q))?.[1]
    ?? defs.find(d => d.custom && (q.includes(d.label.toLowerCase()) || d.label.toLowerCase().includes(q)))?.key
  const def = defs.find(d => d.key === key)
  if (!def) return { text: `I'm not sure which number you mean. Try "what's my squat max" or "what's my 40 time".` }
  const { data: rows } = await ctx.supabase.from('performance_tests').select('result, unit, date').eq('athlete_id', ctx.athlete.id).eq('test_type', def.key).order('date')
  const list = (rows ?? []) as { result: number; unit: string; date: string }[]
  if (!list.length) return { text: `No ${def.label} results yet.` }
  const latest = list[list.length - 1]
  const best = list.reduce((b, r) => (def.higherIsBetter ? Number(r.result) > Number(b.result) : Number(r.result) < Number(b.result)) ? r : b)
  const u = latest.unit || def.unit
  let text = `Your latest ${def.label} is ${latest.result} ${u}, on ${formatShortDate(latest.date)}.`
  if (best !== latest) text += ` Your best is ${best.result} ${u}.`
  else if (list.length > 1) text += ' That is your best ever.'
  return { text }
}

export async function voiceRank(what: string | null) {
  const ctx = await me()
  if (!ctx) return { text: 'Please sign in again.' }
  const admin = createAdminClient()
  if (!ctx.athlete.coach_id || !admin) return { text: 'The leaderboard needs a coach and team first.' }
  const board = await getTeamBoard(admin, ctx.athlete.coach_id)
  const mine = board.metrics
    .map(m => ({ m, i: m.rows.findIndex(r => r.athleteId === ctx.athlete.id) }))
    .filter(x => x.i >= 0)
  if (!mine.length) return { text: "You're not on the leaderboard yet. Log your main lifts or get tested to show up." }
  if (what) {
    const q = what.toLowerCase()
    const hit = mine.find(x => x.m.label.toLowerCase().includes(q) || q.includes(x.m.label.toLowerCase().split(' ')[0]))
      ?? mine.find(x => LIFT_WORDS.some(([re, k]) => re.test(q) && x.m.key === k) || TEST_WORDS.some(([re, k]) => re.test(q) && x.m.key === k))
    if (hit) return { text: `You're ${ordinal(hit.i + 1)} of ${hit.m.rows.length} in ${hit.m.label}, at ${hit.m.rows[hit.i].value} ${hit.m.unit}.` }
  }
  const top = [...mine].sort((a, b) => a.i - b.i).slice(0, 3)
  return { text: `You're ${top.map(x => `${ordinal(x.i + 1)} in ${x.m.label}`).join(', ')}.` }
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export async function voiceMove(day: string) {
  const ctx = await me()
  if (!ctx) return { text: 'Please sign in again.' }
  const s = await getAthleteSchedule(ctx.supabase, ctx.athlete.id)
  const p = pickWorkout(s.items, s.today)
  if (!p) return { text: "There's no open workout to move." }
  const today = todayISO()
  let date = today
  if (day === 'tomorrow') date = addDays(today, 1)
  else if (day !== 'today') {
    const want = WEEKDAYS.indexOf(day)
    if (want < 0) return { text: "Which day? Say something like 'move my workout to Thursday'." }
    const now = new Date(`${today}T00:00:00Z`).getUTCDay()
    date = addDays(today, ((want - now + 7) % 7) || 7)
  }
  const res = await rescheduleWorkout(ctx.athlete.id, p.w.workoutId, date)
  if (res && 'error' in res && res.error) return { text: `I couldn't move it: ${res.error}` }
  return { text: `Done. ${p.w.title} is now on ${dayName(date)}, ${formatShortDate(date).split(', ')[1]}.` }
}

export async function voiceCoach() {
  const ctx = await me()
  return { coachUserId: ctx?.coach?.user_id ?? null, coachName: ctx?.coach?.name ?? null }
}

export async function voiceUnread() {
  const ctx = await me()
  if (!ctx) return { text: 'Please sign in again.' }
  const { data } = await ctx.supabase
    .from('messages')
    .select('content, sender_id, created_at')
    .eq('receiver_id', ctx.user.id)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(3)
  const list = (data ?? []) as { content: string; sender_id: string }[]
  if (!list.length) return { text: 'No new messages.' }
  const fromCoach = (id: string) => (id === ctx.coach?.user_id ? `Coach ${ctx.coach?.name?.split(' ')[0] ?? ''}`.trim() : 'Someone')
  const lines = list.reverse().map(m => `${fromCoach(m.sender_id)} says: ${m.content.replace(/^🎥\s*/, 'sent a video, ').replace(/^📝\s*/, '').slice(0, 220)}`)
  return { text: `You have ${list.length} new message${list.length === 1 ? '' : 's'}. ${lines.join('. ')}. Open messages to reply, or say "message coach" and what you want to say.` }
}

export async function voiceNextForm() {
  const ctx = await me()
  if (!ctx) return { id: null as string | null, title: '' }
  const { due } = await getMyForms(ctx.supabase, ctx.athlete.id)
  return { id: due[0]?.id ?? null, title: due[0]?.title ?? '' }
}
