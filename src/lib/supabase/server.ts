import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = 'https://umyjdxynqacupuetqpkj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVteWpkeHlucWFjdXB1ZXRxcGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDA0MzEsImV4cCI6MjA5NjUxNjQzMX0.mSqFNcVd3kuUSDem-hb50wiZ8Atapz-NXOW524awGyA'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options))
        } catch {}
      },
    },
  })
}