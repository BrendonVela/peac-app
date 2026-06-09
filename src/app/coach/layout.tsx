import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CoachNav } from '@/components/layout/CoachNav'

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (user.user_metadata?.role !== 'coach') redirect('/athlete/dashboard')

  return (
    <div className="min-h-screen bg-zinc-950">
      <CoachNav />
      <main className="md:ml-60 min-h-screen">
        <div className="pt-14 md:pt-0 px-4 md:px-8 py-6 md:py-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
