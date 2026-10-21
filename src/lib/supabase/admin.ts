import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client that bypasses row-level security.
 * Used for sending notifications to other people and for the daily reminder job.
 * NEVER import this from a 'use client' file.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
