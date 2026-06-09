'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { createAthlete } from '@/app/actions/programs'
import type { Athlete } from '@/types'

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('coaches')
        .select('id')
        .eq('user_id', user.id)
        .single()
        .then(({ data: coach }) => {
          if (!coach) return
          supabase
            .from('athletes')
            .select('*')
            .eq('coach_id', coach.id)
            .order('name')
            .then(({ data }) => setAthletes(data ?? []))
        })
    })
  }, [showModal])

  const filtered = athletes.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.sport ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await createAthlete(new FormData(e.currentTarget))
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setShowModal(false)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Athletes</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{athletes.length} total</p>
        </div>
        <Button onClick={() => setShowModal(true)} size="sm">
          <Plus className="w-4 h-4" />
          Add Athlete
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search athletes..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-3">
          {filtered.map(athlete => (
            <Link key={athlete.id} href={`/coach/athletes/${athlete.id}`}>
              <Card className="hover:border-zinc-700 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center text-blue-400 font-semibold text-sm shrink-0">
                      {athlete.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">{athlete.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {athlete.sport && <Badge variant="blue">{athlete.sport}</Badge>}
                        {athlete.position && <span className="text-xs text-zinc-500">{athlete.position}</span>}
                        {athlete.graduation_year && (
                          <span className="text-xs text-zinc-500">Class of {athlete.graduation_year}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-zinc-400 mb-2">
              {search ? 'No athletes match your search.' : 'No athletes yet.'}
            </p>
            {!search && (
              <Button onClick={() => setShowModal(true)} variant="secondary" size="sm">
                Add your first athlete
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Athlete">
        <form onSubmit={handleAdd} className="space-y-4">
          <Input label="Full Name" name="name" placeholder="John Smith" required />
          <Input label="Sport" name="sport" placeholder="Football" />
          <Input label="Position" name="position" placeholder="Wide Receiver" />
          <Input label="Graduation Year" name="graduation_year" type="number" placeholder="2026" min={2020} max={2035} />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              Add Athlete
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
