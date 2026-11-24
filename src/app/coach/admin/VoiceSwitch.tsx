'use client'

import { useEffect, useState, useTransition } from 'react'
import { Mic, Volume2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { getVoiceChoices, setVoiceAllowed, setVoiceSettings } from '@/lib/voice/core'
import { setVoiceForEveryone } from '@/app/actions/admin'

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cn('w-11 h-6 rounded-full relative transition-colors shrink-0 disabled:opacity-50', on ? 'bg-blue-600' : 'bg-zinc-700')}>
      <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  )
}

/** Admin: voice coach + microphone, for me (this phone) and for everyone */
export function VoiceSwitch({ everyone: initial }: { everyone: boolean }) {
  const [everyone, setEveryone] = useState(initial)
  const [mine, setMine] = useState(true)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  useEffect(() => { const c = getVoiceChoices(); setMine(c.enabled && c.mic) }, [])

  function changeMine(on: boolean) {
    setVoiceSettings({ enabled: on, mic: on })
    setMine(on)
  }

  function changeEveryone(on: boolean) {
    setError('')
    start(async () => {
      const r = await setVoiceForEveryone(on)
      if (r?.error) { setError(r.error); return }
      setEveryone(on)
      setVoiceAllowed(on)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Volume2 className="w-4 h-4 text-blue-400" /> Voice coach &amp; microphone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white">For me</p>
            <p className="text-xs text-zinc-500">Turns the talking and the mic off on this phone or computer only, including when you view as an athlete.</p>
          </div>
          <Switch on={mine} onChange={changeMine} label="Voice coach for me" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white flex items-center gap-1.5"><Mic className="w-3.5 h-3.5 text-red-400" /> For everyone</p>
            <p className="text-xs text-zinc-500">
              {everyone
                ? 'On. Every athlete can use the voice coach and mic (each person can still turn theirs off in Settings).'
                : 'Off for every coach and athlete. Open phones go quiet within a minute. Their Settings say it is being worked on.'}
            </p>
          </div>
          <Switch on={everyone} onChange={changeEveryone} label="Voice coach for everyone" disabled={pending} />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </CardContent>
    </Card>
  )
}
