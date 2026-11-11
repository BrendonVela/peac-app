'use client'

import { useRouter } from 'next/navigation'
import { CheckInForm } from '@/components/CheckInForm'

export default function CheckInPage() {
  const router = useRouter()
  return <CheckInForm onDone={() => { router.push('/athlete/dashboard'); router.refresh() }} />
}
