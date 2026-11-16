import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPABASE_URL = 'https://umyjdxynqacupuetqpkj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVteWpkeHlucWFjdXB1ZXRxcGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDA0MzEsImV4cCI6MjA5NjUxNjQzMX0.mSqFNcVd3kuUSDem-hb50wiZ8Atapz-NXOW524awGyA'

/**
 * Keeps people logged in: refreshes the login token before pages load and saves the
 * new one in the browser. Without this, tokens could get refreshed on the server but
 * never saved, which made logins fail or bounce back to the login page.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  try {
    await supabase.auth.getUser()
  } catch {
    // Supabase unreachable: let the page load anyway
  }
  return response
}

export const config = {
  // Skip build files, images, videos, body-tracking models and the service worker
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|mediapipe/|videos/|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|tflite|wasm|binarypb|data|webmanifest)$).*)',
  ],
}
