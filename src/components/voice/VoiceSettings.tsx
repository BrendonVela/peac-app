'use client'

import { useEffect, useState } from 'react'
import { Mic, Volume2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { canListen, canSpeak, getVoiceSettings, listVoices, setVoiceSettings, speak, type VoiceSettings as VS } from '@/lib/voice/core'

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cn('w-11 h-6 rounded-full relative transition-colors shrink-0', on ? 'bg-blue-600' : 'bg-zinc-700')}>
      <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  )
}

/** Voice coach on/off, which voice, how fast, and hands-free answers */
export function VoiceSettings() {
  const [s, setS] = useState<VS | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    setS(getVoiceSettings())
    const load = () => setVoices(listVoices())
    load()
    if (canSpeak()) window.speechSynthesis.onvoiceschanged = load
    const t = setTimeout(load, 800) // some phones load voices late
    return () => clearTimeout(t)
  }, [])

  function update(patch: Partial<VS>) {
    setVoiceSettings(patch)
    setS(getVoiceSettings())
  }

  if (!s) return null
  const selected = s.voiceURI ?? ''

  return (
    <Card id="voice">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Volume2 className="w-4 h-4 text-blue-400" /> Voice coach</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white">Talk to me</p>
            <p className="text-xs text-zinc-500">Welcomes you, reads your check-in and walks you through workouts. Tap the blue mic to talk back.</p>
          </div>
          <Switch on={s.enabled} onChange={v => update({ enabled: v })} label="Voice coach" />
        </div>

        {s.enabled && (
          <>
            {!canSpeak() && <p className="text-xs text-amber-300">This browser can&apos;t talk out loud.</p>}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">Voice</label>
              <div className="flex gap-2">
                <select
                  value={selected}
                  onChange={e => update({ voiceURI: e.target.value || null })}
                  className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Automatic (best on this phone)</option>
                  {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                </select>
                <button onClick={() => speak("Hey, it's your coach. Let's get to work.", { force: true })} className="rounded-lg border border-zinc-700 px-3 text-sm text-zinc-200">Test</button>
              </div>
              <p className="text-[11px] text-zinc-500">Voices come from your phone, so iPhone and Android have different ones. iPhone: more voices in Settings → Accessibility → Spoken Content → Voices.</p>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-zinc-400">
                <span>Speed</span><span className="normal-case text-zinc-300">{s.rate.toFixed(2)}×</span>
              </label>
              <input type="range" min={0.7} max={1.5} step={0.05} value={s.rate} onChange={e => update({ rate: Number(e.target.value) })} className="w-full" />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white flex items-center gap-1.5"><Mic className="w-3.5 h-3.5 text-red-400" /> Answer out loud</p>
                <p className="text-xs text-zinc-500">After I ask something (like check-in questions), I listen for your answer — no tapping.</p>
              </div>
              <Switch on={s.autoListen} onChange={v => update({ autoListen: v })} label="Answer out loud" />
            </div>
            {!canListen() && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                This browser can&apos;t listen, so you&apos;ll answer with taps. Listening works best in Chrome (Android) or Safari/Chrome on iPhone rather than the home-screen app.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
