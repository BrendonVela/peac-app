import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, BookOpen, Activity, TrendingUp, ChevronRight } from 'lucide-react'

export default async function CoachDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, name')
    .eq('user_id', user.id)
    .single()

  if (!coach) redirect('/login')

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, sport')
    .eq('coach_id', coach.id)

  const { data: programs } = await supabase
    .from('programs')
    .select('id, title, created_at')
    .eq('coach_id', coach.id)
    .order('created_at', { ascending: false })

  const athleteIds = (athletes ?? []).map((a: any) => a.id)

  const { data: recentResults } = athleteIds.length > 0
    ? await supabase
        .from('workout_results')
        .select('id, completed, logged_at, athlete_id, athletes(name)')
        .in('athlete_id', athleteIds)
        .order('logged_at', { ascending: false })
        .limit(5)
    : { data: [] }

  const today = new Date().toISOString().split('T')[0]
  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('athlete_id, readiness_score, athletes(name)')
    .eq('date', today)

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>
        Welcome back, {coach.name}
      </h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>Here's what's happening today.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>Total Athletes</div>
          <div style={{ fontSize: '32px', fontWeight: '600' }}>{athletes?.length ?? 0}</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>Active Programs</div>
          <div style={{ fontSize: '32px', fontWeight: '600' }}>{programs?.length ?? 0}</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>Check-ins Today</div>
          <div style={{ fontSize: '32px', fontWeight: '600' }}>{checkIns?.length ?? 0}</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>Recent Results</div>
          <div style={{ fontSize: '32px', fontWeight: '600' }}>{recentResults?.length ?? 0}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Your Athletes</h2>
          {(athletes ?? []).length === 0 ? (
            <p style={{ color: '#666', fontSize: '14px' }}>No athletes yet. <Link href="/coach/athletes/new" style={{ color: '#1d6ef5' }}>Add one</Link></p>
          ) : (
            (athletes ?? []).map((a: any) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontWeight: '500', fontSize: '14px' }}>{a.name}</div>
                <div style={{ color: '#666', fontSize: '13px' }}>{a.sport}</div>
              </div>
            ))
          )}
        </div>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Programs</h2>
          {(programs ?? []).length === 0 ? (
            <p style={{ color: '#666', fontSize: '14px' }}>No programs yet. <Link href="/coach/programs/new" style={{ color: '#1d6ef5' }}>Create one</Link></p>
          ) : (
            (programs ?? []).map((p: any) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontWeight: '500', fontSize: '14px' }}>{p.title}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}