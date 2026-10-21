'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { joinCoach } from '@/app/actions/invites'

export function JoinButton({ code }: { code: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function join() {
    setLoading(true)
    setError('')
    const res = await joinCoach(code)
    setLoading(false)
    if (res && 'error' in res && res.error) { setError(res.error); return }
    router.push('/athlete/dashboard')
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" size="lg" loading={loading} onClick={join}>Join team</Button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
