import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://umyjdxynqacupuetqpkj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVteWpkeHlucWFjdXB1ZXRxcGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDA0MzEsImV4cCI6MjA5NjUxNjQzMX0.mSqFNcVd3kuUSDem-hb50wiZ8Atapz-NXOW524awGyA'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
}