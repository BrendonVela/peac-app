'use client'

import { useEffect, useLayoutEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setVoiceAllowed } from '@/lib/voice/core'

/**
 * Applies the admin's "voice coach on/off for everyone" switch.
 * Starts from what the server knew, then re-checks every minute and when the app comes back to the front,
 * so turning it off reaches phones that already have PEAC open.
 */
export function VoiceGate({ allowed }: { allowed: boolean }) {
  // Runs before the voice screens below it start up
  useLayoutEffect(() => { setVoiceAllowed(allowed) }, [allowed])

  useEffect(() => {
    const supabase = createClient()
    let stop = false
    const check = async () => {
      const { data, error } = await supabase.rpc('voice_allowed')
      if (!stop && !error) setVoiceAllowed(data !== false)
    }
    const t = setInterval(check, 60_000)
    const onShow = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onShow)
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', onShow) }
  }, [])

  return null
}
