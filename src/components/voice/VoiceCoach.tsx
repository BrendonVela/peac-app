'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Mic, X, Volume2, HelpCircle, Timer as TimerIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ask, canListen, dispatchCommand, dispatchVoice, getVoiceSettings, listVoices, listenOnce, onVoiceCommand, onVoiceSettings,
  onVoiceStatus, onWakeState, setVoiceSettings, setWakeHandler, speak, stopListening, stopSpeaking, thinking, type VoiceStatus,
} from '@/lib/voice/core'
import { voiceCoach, voiceInterpret, voiceMove, voiceNextForm, voiceRank, voiceSchedule, voiceStat, voiceToday, voiceUnread, voiceWelcome } from '@/app/actions/voice'
import { sendMessage } from '@/app/actions/messages'
import { formatClock } from '@/lib/rest'

const WELCOMED = 'peac-voice-welcomed'

export const VOICE_HELP: { title: string; lines: string[] }[] = [
  { title: 'Hands-free', lines: ['Say "Hey PEAC" — then what you want ("Hey PEAC, 185 for 5")', 'Or tap the blue mic and talk'] },
  { title: 'Getting around', lines: ['"Open my calendar" / "Go to progress" / "Leaderboard"', '"What\'s my workout today?"', '"Let\'s go" — opens today\'s workout'] },
  { title: 'Check-in', lines: ['Answer each question with a number: "seven"', '"Yes" to submit'] },
  { title: 'During a workout', lines: ['"185 for 5" or "5 reps at 185" — logs the next set', '"Done" — logs the set as written', '"Next" / "Back" / "Repeat" / "What\'s next?"', '"Skip rest" / "Add 30 seconds"'] },
  { title: 'Your numbers', lines: ['"What\'s my squat max?" / "What\'s my 40 time?"', '"Where am I on the leaderboard?"'] },
  { title: 'Everything else', lines: ['"Move today\'s workout to Thursday"', '"Message coach I\'m running late" / "Read my messages"', '"Start a 2 minute timer" / "Stop the timer"', '"Fill out my form"', '"Talk faster" / "Change voice" / "Turn off the voice"'] },
]

/** Floating mic + the voice coach's app-wide commands (athlete side) */
export function VoiceCoach() {
  const router = useRouter()
  const pathname = usePathname()
  const [st, setSt] = useState<VoiceStatus>({ state: 'idle', text: '' })
  const [reply, setReply] = useState('')
  const [help, setHelp] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [timerEnd, setTimerEnd] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const busy = useRef(false)
  const [wakeOn, setWakeOn] = useState(false)
  useEffect(() => onWakeState(setWakeOn), [])

  // "Hey PEAC": starts after the first tap (phones need a tap before using the mic)
  useEffect(() => {
    const arm = () => {
      setWakeHandler(async rest => {
        if (rest) { await handleSaid(rest); return }
        await speak('Yes?')
        try { await handleSaid(await listenOnce(7000)) } catch (e) { setReply((e as Error).message) }
      })
    }
    window.addEventListener('pointerdown', arm, { once: true, capture: true })
    return () => { window.removeEventListener('pointerdown', arm, true); setWakeHandler(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pending = useRef<{ to: string; text: string } | null>(null)

  useEffect(() => onVoiceStatus(setSt), [])
  useEffect(() => { setEnabled(getVoiceSettings().enabled); return onVoiceSettings(s => setEnabled(s.enabled)) }, [])

  /** Say it and show it */
  const say = (text: string) => { setReply(text); return speak(text) }

  // Welcome back — on the first tap of this visit (phones only allow sound after a tap)
  useEffect(() => {
    if (!getVoiceSettings().enabled) return
    let done = false
    try { done = sessionStorage.getItem(WELCOMED) === '1' } catch { /* ignore */ }
    if (done) return
    const go = async (e: Event) => {
      window.removeEventListener('pointerdown', go, true)
      try { sessionStorage.setItem(WELCOMED, '1') } catch { /* ignore */ }
      if ((e.target as HTMLElement)?.closest?.('[data-voice-mic]')) return // they tapped the mic — just listen
      if (!getVoiceSettings().enabled) return
      const w = await voiceWelcome().catch(() => ({ text: '' }))
      if (!w.text) return
      setReply(w.text)
      const answer = await ask(w.text)
      if (answer) handleSaid(answer)
    }
    window.addEventListener('pointerdown', go, true)
    return () => window.removeEventListener('pointerdown', go, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Voice timer
  useEffect(() => {
    if (timerEnd === null) return
    let warned = false
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      const left = (timerEnd - t) / 1000
      if (!warned && left <= 10.5 && left > 9) { warned = true; speak('10 seconds') }
      if (left <= 0) { setTimerEnd(null); speak("Time's up!"); try { navigator.vibrate?.([300, 150, 300]) } catch { /* ignore */ } }
    }, 250)
    return () => clearInterval(id)
  }, [timerEnd])

  // App-wide commands (screens like the workout handle their own first)
  useEffect(() => onVoiceCommand(async cmd => {
    switch (cmd.type) {
      case 'help': setHelp(true); await say('Here are some things you can say. Tap any time and talk.'); return true
      case 'stop': stopSpeaking(); setReply(''); return true
      case 'voice_off': await speak('Okay, voice coach off. You can turn me back on in Settings.'); setVoiceSettings({ enabled: false }); return true
      case 'faster': { const r = Math.min(1.5, getVoiceSettings().rate + 0.15); setVoiceSettings({ rate: r }); await say('Okay, talking faster.'); return true }
      case 'slower': { const r = Math.max(0.7, getVoiceSettings().rate - 0.15); setVoiceSettings({ rate: r }); await say('Okay, talking slower.'); return true }
      case 'change_voice': {
        const vs = listVoices()
        if (vs.length < 2) { await say('This phone only has one voice. More voices may be in your phone settings.'); return true }
        const cur = getVoiceSettings().voiceURI
        const i = vs.findIndex(v => v.voiceURI === cur)
        const next = vs[(i + 1) % vs.length]
        setVoiceSettings({ voiceURI: next.voiceURI })
        await say(`Hi, I'm ${next.name.split(/[ (]/)[0]}. How's this voice?`)
        return true
      }
      case 'nav': await say(`Opening ${cmd.label}.`); router.push(cmd.page); return true
      case 'today': { thinking(true); const r = await voiceToday(); thinking(false); await say(r.text); return true }
      case 'schedule': { thinking(true); const r = await voiceSchedule(cmd.when); thinking(false); await say(r.text); return true }
      case 'finish': await say("Nice work today! Open the workout and tap Finish to rate how hard it was. Or say \"let's go\" to open it."); return true
      case 'rest_left': await say("There's no rest timer running right now."); return true
      case 'start': {
        thinking(true); const r = await voiceToday(); thinking(false)
        if (!r.workoutId) { await say(r.text); return true }
        await say("Let's do it. Opening your workout.")
        router.push(`/athlete/workout/${r.workoutId}?voice=1`)
        return true
      }
      case 'next': case 'back': case 'done': case 'log': case 'whats_next': case 'skip_rest': case 'add_rest': case 'undo': case 'correct':
        await say('Open your workout first. Say "let\'s go".'); return true
      case 'repeat': if (reply) await speak(reply); return true
      case 'timer':
        setTimerEnd(Date.now() + cmd.seconds * 1000); setNow(Date.now())
        await say(`Timer started. ${cmd.seconds >= 60 ? `${Math.round((cmd.seconds / 60) * 10) / 10} minutes` : `${cmd.seconds} seconds`}.`)
        return true
      case 'stop_timer': setTimerEnd(null); await say('Timer stopped.'); return true
      case 'stat': { thinking(true); const r = await voiceStat(cmd.what); thinking(false); await say(r.text); return true }
      case 'rank': { thinking(true); const r = await voiceRank(cmd.what); thinking(false); await say(r.text); return true }
      case 'move': { thinking(true); const r = await voiceMove(cmd.day); thinking(false); await say(r.text); router.refresh(); return true }
      case 'read_messages': { thinking(true); const r = await voiceUnread(); thinking(false); await say(r.text); return true }
      case 'message': {
        thinking(true); const c = await voiceCoach(); thinking(false)
        if (!c.coachUserId) { await say("You don't have a coach to message yet."); return true }
        const yes = await ask(`Send this to coach ${c.coachName?.split(' ')[0] ?? ''}: "${cmd.text}". Should I send it?`)
        const ok = yes ? /^(yes|yeah|yep|sure|send|ok|okay|do it|correct)/i.test(yes.trim()) : false
        if (!yes) { setReply(`Tap the mic and say "yes" to send: "${cmd.text}"`); pending.current = { to: c.coachUserId, text: cmd.text }; return true }
        if (ok) { await sendMessage(c.coachUserId, cmd.text, '/athlete/messages'); await say('Sent.') } else await say("Okay, I won't send it.")
        return true
      }
      case 'yes':
        if (pending.current) { const p = pending.current; pending.current = null; await sendMessage(p.to, p.text, '/athlete/messages'); await say('Sent.'); return true }
        return false
      case 'no':
        if (pending.current) { pending.current = null; await say("Okay, I won't send it."); return true }
        return false
      case 'form': {
        thinking(true); const f = await voiceNextForm(); thinking(false)
        if (!f.id) { await say("You're all caught up. No forms to fill out."); return true }
        await say(`Opening ${f.title}.`); router.push(`/athlete/forms/${f.id}?voice=1`); return true
      }
      case 'checkin':
        await say('Opening your check-in.'); router.push('/athlete/checkin?voice=1'); return true
      default: return false
    }
  }, 0), [router, reply]) // eslint-disable-line react-hooks/exhaustive-deps

  const misses = useRef(0)
  async function handleSaid(text: string) {
    if (!text) { await say("I didn't hear anything. Try again a little closer to the phone."); return }
    setReply('')
    let ok = await dispatchVoice(text)
    if (!ok) {
      // Optional AI help (only if an AI key is set up)
      thinking(true)
      const ai = await voiceInterpret(text, pathname ?? '').catch(() => ({ cmd: null }))
      thinking(false)
      if (ai.cmd) ok = await dispatchCommand(ai.cmd as never, text)
    }
    if (ok) { misses.current = 0; return }
    misses.current++
    await say(misses.current >= 2
      ? `I heard "${text}", but I'm not sure what to do with it. Tap "What can I say" below for examples.`
      : `I heard "${text}". Can you say that another way?`)
  }

  async function tap() {
    if (st.state === 'speaking') { stopSpeaking(); return }
    if (st.state === 'listening') { stopListening(); return }
    if (busy.current) return
    if (!canListen()) {
      setHelp(true)
      setReply("Voice commands don't work in this browser (common on iPhone home-screen apps). The coach can still talk to you — use the buttons, or open PEAC in Chrome.")
      return
    }
    busy.current = true
    try {
      const said = await listenOnce(8000)
      await handleSaid(said)
    } catch (e) {
      setReply((e as Error).message)
    } finally { busy.current = false }
  }

  if (!enabled) return null
  const timerLeft = timerEnd ? Math.max(0, (timerEnd - now) / 1000) : 0
  const bubble = st.state === 'listening' ? (st.text || 'Listening…') : st.state === 'thinking' ? 'One sec…' : reply

  return (
    <>
      <div className="voice-coach fixed right-3 z-[45] flex flex-col items-end gap-2 md:right-6" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6.5rem)' }}>
        {timerEnd !== null && (
          <button onClick={() => setTimerEnd(null)} className="flex items-center gap-1.5 rounded-full bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-sm font-semibold tabular-nums text-white shadow-lg">
            <TimerIcon className="w-4 h-4 text-blue-400" /> {formatClock(timerLeft)} <X className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        )}
        {bubble && (
          <div className="max-w-[17rem] rounded-2xl rounded-br-sm border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-sm text-zinc-100 shadow-xl backdrop-blur">
            <div className="flex items-start gap-2">
              {st.state === 'speaking' && <Volume2 className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />}
              {st.state === 'listening' && <Mic className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />}
              <p className={cn('flex-1', st.state === 'listening' && !st.text && 'text-zinc-400')}>{bubble}</p>
              {st.state !== 'listening' && (
                <button onClick={() => { stopSpeaking(); setReply('') }} className="text-zinc-500 hover:text-white" aria-label="Close"><X className="w-3.5 h-3.5" /></button>
              )}
            </div>
            {st.state === 'idle' && reply && (
              <button onClick={() => setHelp(true)} className="mt-1 flex items-center gap-1 text-[11px] text-blue-300"><HelpCircle className="w-3 h-3" /> What can I say?</button>
            )}
          </div>
        )}
        <button
          data-voice-mic
          onClick={tap}
          aria-label={st.state === 'listening' ? 'Stop listening' : st.state === 'speaking' ? 'Stop talking' : 'Talk to your coach'}
          className={cn(
            'relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl border transition-transform active:scale-95',
            st.state === 'listening' ? 'bg-red-600 border-red-400 animate-pulse' : st.state === 'speaking' ? 'bg-blue-500 border-blue-300' : 'bg-blue-600 border-blue-500'
          )}
        >
          {st.state === 'speaking' ? <Volume2 className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
          {wakeOn && st.state === 'idle' && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-zinc-950" title='Listening for "Hey PEAC"' />}
        </button>
      </div>

      {help && (
        <div className="fixed inset-0 z-[80] bg-black/60" onClick={() => setHelp(false)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-zinc-800 bg-zinc-900 p-5 md:inset-x-auto md:right-6 md:bottom-6 md:w-96 md:rounded-2xl md:border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">What you can say</h2>
              <button onClick={() => setHelp(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-zinc-400 mb-4">Say <b className="text-white">&quot;Hey PEAC&quot;</b> or tap the blue mic, then talk. A green dot on the mic means I&apos;m listening for &quot;Hey PEAC&quot;. Tap the mic again to stop me talking.</p>
            <div className="space-y-4">
              {VOICE_HELP.map(g => (
                <div key={g.title}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-300 mb-1">{g.title}</p>
                  <ul className="space-y-1">{g.lines.map(l => <li key={l} className="text-sm text-zinc-200">{l}</li>)}</ul>
                </div>
              ))}
            </div>
            {!canListen() && <p className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-100">This browser can&apos;t listen, so voice commands won&apos;t work here. The coach can still talk to you. On iPhone, voice commands work best in Safari or Chrome rather than the home-screen app.</p>}
            {pathname?.startsWith('/athlete/settings') ? null : (
              <button onClick={() => { setHelp(false); router.push('/athlete/settings#voice') }} className="mt-5 w-full rounded-lg border border-zinc-700 py-2.5 text-sm text-zinc-300">Voice settings</button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
