'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, ChevronRight, Pencil, X, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { createAthlete, claimAthlete, updateAthlete, unclaimAthlete } from '@/app/actions/programs'
import { deleteAthlete } from '@/app/actions/admin'
import type { Athlete } from '@/types'
import { InviteCard } from './InviteCard'

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
const [unclaimed, setUnclaimed] = useState<Athlete[]>([])
const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null)
const [editError, setEditError] = useState('')
const [editLoading, setEditLoading] = useState(false)
const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    const supabase = createClient()
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(data === true))
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
            supabase
          .from('athletes')
          .select('*')
          .is('coach_id', null)
          .not('user_id', 'is', null)
          .then(({ data }) => setUnclaimed(data ?? []))
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
async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault()
  if (!editingAthlete) return
  setEditLoading(true)
  setEditError('')

  const form = new FormData(e.currentTarget)
  const result = await updateAthlete(editingAthlete.id, {
    name: form.get('name') as string,
    sport: form.get('sport') as string,
    position: form.get('position') as string,
    graduation_year: form.get('graduation_year')
      ? parseInt(form.get('graduation_year') as string)
      : null,
  })

  if (result?.error) {
    setEditError(result.error)
    setEditLoading(false)
  } else {
    setAthletes(prev =>
      prev.map(a =>
        a.id === editingAthlete.id
          ? {
              ...a,
              name: form.get('name') as string,
              sport: form.get('sport') as string,
              position: form.get('position') as string,
              graduation_year: form.get('graduation_year')
                ? parseInt(form.get('graduation_year') as string)
                : null,
            }
          : a
      )
    )
    setEditingAthlete(null)
    setEditLoading(false)
  }
}

async function handleUnclaim(athleteId: string) {
  if (!confirm('Remove this athlete from your roster? They will become unclaimed.')) return
  const result = await unclaimAthlete(athleteId)
  if (!result?.error) {
    setAthletes(prev => prev.filter(a => a.id !== athleteId))
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

      <InviteCard />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search athletes..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
{unclaimed.length > 0 && (
  <Card className="border-blue-600/40 bg-blue-600/5">
    <CardContent className="py-4 space-y-3">
      <p className="text-sm font-medium text-blue-300">
        {unclaimed.length} athlete{unclaimed.length > 1 ? 's' : ''} waiting to be claimed
      </p>
      {unclaimed.map(athlete => (
        <div key={athlete.id} className="flex items-center justify-between bg-zinc-900/50 rounded-lg px-3 py-2">
          <div>
            <p className="text-sm font-medium text-white">{athlete.name}</p>
            {athlete.sport && <p className="text-xs text-zinc-500">{athlete.sport}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={async () => {
                await claimAthlete(athlete.id)
                setUnclaimed(prev => prev.filter(a => a.id !== athlete.id))
              }}
            >
              Claim
            </Button>
            {isAdmin && (
              <button
                title="Delete athlete"
                className="p-1.5 text-zinc-500 hover:text-red-400"
                onClick={async () => {
                  if (!confirm(`Permanently delete ${athlete.name} and their login? This can't be undone.`)) return
                  const res = await deleteAthlete(athlete.id)
                  if (res && 'error' in res && res.error) { alert(res.error); return }
                  setUnclaimed(prev => prev.filter(a => a.id !== athlete.id))
                }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
)}
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
            
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setEditingAthlete(athlete)
                  setEditError('')
                }}
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white"
                title="Edit athlete"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleUnclaim(athlete.id)
                }}
                className="p-1.5 rounded-md hover:bg-red-900/30 text-zinc-400 hover:text-red-400"
                title="Remove from roster"
              >
                <X className="w-4 h-4" />
              </button>
              <ChevronRight className="w-4 h-4 text-zinc-600" />
            </div>
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

      <Modal
        open={!!editingAthlete}
        onClose={() => setEditingAthlete(null)}
        title="Edit Athlete"
      >
        {editingAthlete && (
          <form key={editingAthlete.id} onSubmit={handleEditSubmit} className="space-y-4">
            <Input label="Full Name" name="name" defaultValue={editingAthlete.name} required />
            <Input label="Sport" name="sport" defaultValue={editingAthlete.sport ?? ''} placeholder="Football" />
            <Input label="Position" name="position" defaultValue={editingAthlete.position ?? ''} placeholder="Wide Receiver" />
            <Input
              label="Graduation Year"
              name="graduation_year"
              type="number"
              defaultValue={editingAthlete.graduation_year ?? ''}
              placeholder="2026"
              min={2020}
              max={2035}
            />

            {editError && <p className="text-sm text-red-400">{editError}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEditingAthlete(null)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" loading={editLoading} className="flex-1">
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

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
