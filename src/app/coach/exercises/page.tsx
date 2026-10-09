'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Play, VideoOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { createExercise, updateExercise, deleteExercise } from '@/app/actions/exercises'
import { EXERCISE_CATEGORIES } from '@/lib/utils'
import type { Exercise } from '@/types'

const NO_VIDEO = 'No Video'

const CATEGORY_COLORS: Record<string, 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'default'> = {
  Speed: 'blue',
  Strength: 'red',
  Plyometrics: 'yellow',
  Mobility: 'green',
  Conditioning: 'purple',
  Recovery: 'default',
  Core: 'purple',
  'Med Ball': 'yellow',
}

function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/)|studio\.youtube\.com\/video\/)([a-zA-Z0-9_-]{11})/
  )
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openVideoId, setOpenVideoId] = useState<string | null>(null)

  function loadExercises() {
    const supabase = createClient()
    supabase.from('exercises').select('*').order('title').then(({ data }) => setExercises(data ?? []))
  }

  useEffect(() => { loadExercises() }, [])

  const noVideoCount = exercises.filter(e => !e.video_url).length

  const filtered = exercises.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase())
    const matchCat =
      category === 'All' ||
      (category === NO_VIDEO ? !e.video_url : e.category === category)
    return matchSearch && matchCat
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)

    const result = editing
      ? await updateExercise(editing.id, fd)
      : await createExercise(fd)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setShowModal(false)
      setEditing(null)
      setLoading(false)
      loadExercises()
    }
  }

  async function handleDelete(ex: Exercise) {
    const msg = ex.video_url
      ? `Delete "${ex.title}"?`
      : `Delete "${ex.title}"? It will also be removed from any programs that use it.`
    if (!confirm(msg)) return
    const result: any = await deleteExercise(ex.id)
    if (result?.error) {
      alert(`Could not delete: ${result.error}`)
    }
    loadExercises()
  }

  function openNew() { setEditing(null); setError(''); setShowModal(true) }
  function openEdit(ex: Exercise) { setEditing(ex); setError(''); setShowModal(true) }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exercise Library</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            {exercises.length} exercises
            {noVideoCount > 0 && (
              <span className="text-amber-400"> · {noVideoCount} without video</span>
            )}
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4" />
          Add Exercise
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exercises..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['All', ...EXERCISE_CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                category === cat
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}

          {/* No Video filter */}
          <button
            onClick={() => setCategory(NO_VIDEO)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              category === NO_VIDEO
                ? 'bg-amber-500 border-amber-500 text-black'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
            }`}
          >
            <VideoOff className="w-3.5 h-3.5" />
            No Video ({noVideoCount})
          </button>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(ex => (
            <Card
              key={ex.id}
              className={`hover:border-zinc-700 transition-colors ${!ex.video_url ? 'border-amber-500/30' : ''}`}
            >
              <CardContent className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-sm truncate" title={ex.title}>{ex.title}</h3>
                    <Badge variant={CATEGORY_COLORS[ex.category] ?? 'default'} className="mt-1">
                      {ex.category}
                    </Badge>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(ex)} className="text-zinc-500 hover:text-white p-1" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(ex)} className="text-zinc-500 hover:text-red-400 p-1" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {ex.description && (
                  <p className="text-xs text-zinc-400 line-clamp-2">{ex.description}</p>
                )}

                {ex.coaching_cues && (
                  <p className="text-xs text-zinc-500 italic line-clamp-2">&ldquo;{ex.coaching_cues}&rdquo;</p>
                )}

                {ex.video_url ? (
                  openVideoId !== ex.id ? (
                    <button
                      onClick={() => setOpenVideoId(ex.id)}
                      className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <Play className="w-3 h-3" />
                      Watch demo
                    </button>
                  ) : (
                    getYouTubeEmbedUrl(ex.video_url) && (
                      <div className="mt-2 aspect-video w-full overflow-hidden rounded-lg">
                        <iframe
                          src={getYouTubeEmbedUrl(ex.video_url)!}
                          title={`${ex.title} demo`}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )
                  )
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-amber-400">
                      <VideoOff className="w-3 h-3" />
                      No video
                    </span>
                    <button
                      onClick={() => openEdit(ex)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      + Add video
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-zinc-400 mb-3">
              {category === NO_VIDEO && !search
                ? 'Every exercise has a video.'
                : search || category !== 'All'
                  ? 'No exercises match your filters.'
                  : 'No exercises yet.'}
            </p>
            {!search && category === 'All' && (
              <Button onClick={openNew} variant="secondary" size="sm">Add your first exercise</Button>
            )}
          </CardContent>
        </Card>
      )}

      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null) }}
        title={editing ? 'Edit Exercise' : 'Add Exercise'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Exercise Name"
            name="title"
            defaultValue={editing?.title ?? ''}
            placeholder="e.g. Box Jump"
            required
          />
          <Select label="Category" name="category" defaultValue={editing?.category ?? 'Strength'}>
            {EXERCISE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </Select>
          <Textarea
            label="Description (optional)"
            name="description"
            defaultValue={editing?.description ?? ''}
            placeholder="Brief description of the exercise"
            rows={2}
          />
          <Textarea
            label="Coaching Cues (optional)"
            name="coaching_cues"
            defaultValue={editing?.coaching_cues ?? ''}
            placeholder="Key technique cues for athletes"
            rows={2}
          />
          <Input
            label="Video URL (optional)"
            name="video_url"
            defaultValue={editing?.video_url ?? ''}
            placeholder="https://youtube.com/..."
            type="url"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowModal(false); setEditing(null) }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              {editing ? 'Save Changes' : 'Add Exercise'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}