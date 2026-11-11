'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckInForm } from '@/components/CheckInForm'

export default function CheckInPage() {
  const router = useRouter()
  const [voice, setVoice] = useState<boolean | null>(null)
  useEffect(() => { setVoice(new URLSearchParams(window.location.search).get('voice') === '1') }, [])
  if (voice === null) return null
  return <CheckInForm voice={voice} onDone={() => { router.push('/athlete/dashboard'); router.refresh() }} />
}
