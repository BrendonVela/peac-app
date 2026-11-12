'use client'
// PEAC voice coach: talking (phone's built-in voices), listening (built-in speech recognition)
// and a small command bus so any screen can react to what the athlete says. Free — nothing leaves the phone
// except what the browser's own speech service needs.

import { afterWakeWord, parseCommand, type Command } from './parse'

// ---------------- Settings ----------------
export interface VoiceSettings {
  enabled: boolean          // coach talks
  voiceURI: string | null   // chosen voice (null = best English voice on this phone)
  rate: number              // 0.8 – 1.4
  autoListen: boolean       // after a question, listen for the answer automatically
  wakeWord: boolean         // quietly listen for "Hey PEAC"
}
const KEY = 'peac-voice'
const DEFAULTS: VoiceSettings = { enabled: true, voiceURI: null, rate: 1, autoListen: true, wakeWord: true }
const settingSubs = new Set<(s: VoiceSettings) => void>()

export function getVoiceSettings(): VoiceSettings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEFAULTS }
}
export function setVoiceSettings(patch: Partial<VoiceSettings>) {
  const next = { ...getVoiceSettings(), ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
  settingSubs.forEach(f => f(next))
  if (!next.enabled) stopSpeaking()
  if (!next.enabled || !next.wakeWord) stopWake()
  else scheduleWake()
}
export function onVoiceSettings(f: (s: VoiceSettings) => void) { settingSubs.add(f); return () => { settingSubs.delete(f) } }

// ---------------- Status (for the mic bubble) ----------------
export type VoiceStatus = { state: 'idle' | 'speaking' | 'listening' | 'thinking'; text: string }
let status: VoiceStatus = { state: 'idle', text: '' }
const statusSubs = new Set<(s: VoiceStatus) => void>()
function setStatus(s: VoiceStatus) {
  status = s
  statusSubs.forEach(f => f(s))
  if (s.state === 'idle') scheduleWake()
  else stopWake()
}
export function onVoiceStatus(f: (s: VoiceStatus) => void) { statusSubs.add(f); f(status); return () => { statusSubs.delete(f) } }
export const thinking = (on: boolean) => setStatus(on ? { state: 'thinking', text: '' } : { state: 'idle', text: '' })

// ---------------- Speaking ----------------
export function canSpeak() { return typeof window !== 'undefined' && 'speechSynthesis' in window }

export function listVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak()) return []
  return window.speechSynthesis.getVoices().filter(v => /^en(-|_|$)/i.test(v.lang))
}

function pickVoice(uri: string | null): SpeechSynthesisVoice | null {
  const all = listVoices()
  if (uri) { const v = all.find(x => x.voiceURI === uri); if (v) return v }
  return all.find(v => /Samantha|Google US English|Microsoft Aria|Microsoft Jenny/i.test(v.name))
    ?? all.find(v => /en[-_]US/i.test(v.lang) && v.localService)
    ?? all.find(v => /en[-_]US/i.test(v.lang)) ?? all[0] ?? null
}

/** Make program text sound right out loud ("4×10 @ 135 lb" -> "4 by 10 at 135 pounds") */
export function speakable(t: string): string {
  return t
    .replace(/[★•·|]/g, ', ')
    .replace(/[—–]/g, ', ')
    .replace(/(\d)\s*[×x]\s*(\d)/gi, '$1 by $2')
    .replace(/\b1RM\b/gi, 'one rep max')
    .replace(/\bRPE\b/g, 'R P E')
    .replace(/\bDB\b/g, 'dumbbell').replace(/\bKB\b/g, 'kettlebell').replace(/\bBW\b/g, 'body weight')
    .replace(/(\d)\s*lbs?\b/gi, '$1 pounds').replace(/\blbs?\b/gi, 'pounds')
    .replace(/(\d)\s*yds?\b/gi, '$1 yards')
    .replace(/(\d)\s*(?:secs?|s)\b/gi, '$1 seconds').replace(/(\d)\s*mins?\b/gi, '$1 minutes')
    .replace(/\/\s*(side|leg|arm|each)\b/gi, ' per $1')
    .replace(/\bea\b/gi, 'each')
    .replace(/@/g, ' at ').replace(/%/g, ' percent').replace(/\+/g, ' plus ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

let speakToken = 0
export function stopSpeaking() {
  speakToken++
  if (canSpeak()) window.speechSynthesis.cancel()
  if (status.state === 'speaking') setStatus({ state: 'idle', text: '' })
}

/** Say something. Resolves when finished (or right away if the voice is off). */
export function speak(text: string, opts: { force?: boolean } = {}): Promise<void> {
  const s = getVoiceSettings()
  if ((!s.enabled && !opts.force) || !canSpeak() || !text.trim()) return Promise.resolve()
  // The shared weight-room tablet stays quiet; so does a playing demo video
  if (!opts.force && (window.location.pathname.startsWith('/kiosk') || pausers.size > 0)) return Promise.resolve()
  stopListening()
  stopWake()
  window.speechSynthesis.cancel()
  const token = ++speakToken
  const clean = speakable(text)
  // Long text gets cut off on some phones -> say it sentence by sentence
  const parts = clean.match(/[^.!?]+[.!?]*/g)?.map(x => x.trim()).filter(Boolean) ?? [clean]
  setStatus({ state: 'speaking', text })
  const voice = pickVoice(s.voiceURI)
  return new Promise(resolve => {
    let i = 0
    const next = () => {
      if (token !== speakToken) return resolve()
      if (i >= parts.length) { if (status.state === 'speaking') setStatus({ state: 'idle', text: '' }); return resolve() }
      const u = new SpeechSynthesisUtterance(parts[i++])
      if (voice) { u.voice = voice; u.lang = voice.lang }
      u.rate = s.rate
      let moved = false
      const go = () => { if (!moved) { moved = true; next() } }
      u.onend = go
      u.onerror = go
      // Some phones never fire "end" — move on after a generous guess
      setTimeout(go, 1500 + (u.text.length * 95) / s.rate)
      window.speechSynthesis.speak(u)
    }
    next()
  })
}

// ---------------- Listening ----------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Recognition(): any {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}
export function canListen() { return !!Recognition() }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let active: any = null
export function stopListening() {
  try { active?.abort?.() } catch { /* ignore */ }
  active = null
  if (status.state === 'listening') setStatus({ state: 'idle', text: '' })
}

/** Listen for one thing the athlete says. Resolves with the words ('' if nothing heard). */
export function listenOnce(maxMs = 8000): Promise<string> {
  const R = Recognition()
  if (!R) return Promise.reject(new Error('Voice commands are not supported in this browser. Try Chrome, or use the buttons.'))
  stopListening()
  stopWake()
  if (canSpeak()) window.speechSynthesis.cancel()
  return new Promise((resolve, reject) => {
    const rec = new R()
    active = rec
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1
    let finalText = ''
    let heard = ''
    setStatus({ state: 'listening', text: '' })
    const timer = setTimeout(() => { try { rec.stop() } catch { /* ignore */ } }, maxMs)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      heard = (finalText || interim).trim()
      setStatus({ state: 'listening', text: heard })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      clearTimeout(timer)
      if (active === rec) active = null
      setStatus({ state: 'idle', text: '' })
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') reject(new Error('Microphone is blocked. Allow the microphone for this site in your phone settings.'))
      else resolve('') // no-speech / aborted / network -> just nothing heard
    }
    rec.onend = () => {
      clearTimeout(timer)
      if (active === rec) active = null
      if (status.state === 'listening') setStatus({ state: 'idle', text: '' })
      resolve((finalText || heard).trim())
    }
    try { rec.start() } catch { clearTimeout(timer); setStatus({ state: 'idle', text: '' }); resolve('') }
  })
}

/** Ask a question out loud and (if auto-listen is on and supported) wait for the answer. '' = no answer. */
export async function ask(question: string): Promise<string> {
  await speak(question)
  const s = getVoiceSettings()
  if (!s.enabled || !s.autoListen || !canListen()) return ''
  try { return await listenOnce(7000) } catch { return '' }
}

// ---------------- Command bus ----------------
export type VoiceHandler = (cmd: Command, raw: string) => boolean | Promise<boolean>
const handlers: { fn: VoiceHandler; priority: number }[] = []
/** Higher priority runs first (the open screen: 10, the whole app: 0). Return true when handled. */
export function onVoiceCommand(fn: VoiceHandler, priority = 0) {
  const h = { fn, priority }
  handlers.push(h)
  handlers.sort((a, b) => b.priority - a.priority)
  return () => { const i = handlers.indexOf(h); if (i >= 0) handlers.splice(i, 1) }
}
export async function dispatchVoice(raw: string): Promise<boolean> {
  return dispatchCommand(parseCommand(raw), raw)
}
/** Run an already-understood command (e.g. one the AI worked out) */
export async function dispatchCommand(cmd: Command, raw: string): Promise<boolean> {
  for (const h of [...handlers]) {
    try { if (await h.fn(cmd, raw)) return true } catch (e) { console.error('[voice]', e) }
  }
  return false
}

// ---------------- Workout loggers (so "185 for 5" reaches the right exercise) ----------------
export interface LoggerApi {
  title: string
  total: number
  doneSets: () => number
  /** Log the next open set. Returns what was logged, or null if every set is already done. */
  logNext: (weight: number | null, reps: number | null) => { set: number; total: number; weight: number | null; reps: number | null; allDone: boolean; restLabel: string | null; rested: boolean } | null
  /** Target weight of the next open set (to sanity-check what was heard) */
  nextTargetWeight: () => number | null
  /** Change a set (1-based) that's already logged */
  fixSet: (set: number, weight: number | null, reps: number | null) => { weight: number | null; reps: number | null } | null
  /** Un-log a set (1-based) */
  undoSet: (set: number) => boolean
}
const loggers = new Map<string, LoggerApi>()
export function registerLogger(id: string, api: LoggerApi) { loggers.set(id, api); return () => { if (loggers.get(id) === api) loggers.delete(id) } }
export function getLogger(id: string) { return loggers.get(id) ?? null }

// ---------------- "Hey PEAC" (hands-free) ----------------
// Quietly listens in the background while the app is open and idle. Hearing "Hey PEAC" calls the
// handler with whatever came after it ("Hey PEAC, next" -> "next"; just "Hey PEAC" -> "").
type WakeHandler = (rest: string) => void
let wakeHandler: WakeHandler | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wakeRec: any = null
let wakeTimer: ReturnType<typeof setTimeout> | null = null
let wakeBlocked = false
const wakeSubs = new Set<(on: boolean) => void>()
const setWakeOn = (on: boolean) => wakeSubs.forEach(f => f(on))
export function onWakeState(f: (on: boolean) => void) { wakeSubs.add(f); f(!!wakeRec); return () => { wakeSubs.delete(f) } }

/** Turn the "Hey PEAC" listener on (with what to do when heard) or off (null) */
export function setWakeHandler(handler: WakeHandler | null) {
  wakeHandler = handler
  if (handler) scheduleWake()
  else stopWake()
}

function stopWake() {
  if (wakeTimer) { clearTimeout(wakeTimer); wakeTimer = null }
  const r = wakeRec
  wakeRec = null
  if (r) { try { r.onend = null; r.abort() } catch { /* ignore */ } setWakeOn(false) }
}

function scheduleWake(delay = 500) {
  if (typeof window === 'undefined') return
  if (wakeTimer) clearTimeout(wakeTimer)
  wakeTimer = setTimeout(startWake, delay)
}

function startWake() {
  wakeTimer = null
  const s = getVoiceSettings()
  const R = Recognition()
  if (!wakeHandler || wakeBlocked || !R || !s.enabled || !s.wakeWord || wakeRec || pausers.size > 0) return
  if (status.state !== 'idle' || active || document.hidden) return
  if (window.location.pathname.startsWith('/kiosk')) return
  const rec = new R()
  wakeRec = rec
  rec.lang = 'en-US'
  rec.continuous = true
  rec.interimResults = true
  let fired = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec.onresult = (e: any) => {
    if (fired) return
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      const rest = afterWakeWord(r[0].transcript)
      if (rest === null) continue
      // Wait for the end of the sentence so "Hey PEAC, 185 for 5" comes through whole
      if (!r.isFinal && rest) continue
      fired = true
      stopWake()
      wakeHandler?.(r.isFinal ? rest : '')
      return
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rec.onerror = (e: any) => {
    if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') wakeBlocked = true
  }
  rec.onend = () => {
    if (wakeRec === rec) { wakeRec = null; setWakeOn(false) }
    if (!fired) scheduleWake(wakeBlocked ? 0 : 800) // keep listening (phones stop after a while)
  }
  try { rec.start(); setWakeOn(true) } catch { wakeRec = null; setWakeOn(false) }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopWake(); else scheduleWake() })
}

// ---------------- Pause while a video plays ----------------
// Phones can't play a video's sound while the mic is listening, so the coach steps aside.
const pausers = new Set<string>()
export function setVoicePaused(reason: string, paused: boolean) {
  if (paused) { pausers.add(reason); stopSpeaking(); stopListening(); stopWake() }
  else { pausers.delete(reason); scheduleWake(800) }
}
export const voicePaused = () => pausers.size > 0
