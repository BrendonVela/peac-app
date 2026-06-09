'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { createProgram } from '@/app/actions/programs'
import { createClient } from '@/lib/supabase/client'
import { DAYS_OF_WEEK, EXERCISE_CATEGORIES } from '@/lib/utils'
import type { Exercise } from '@/types'

interface ExerciseDraft {
  id: string
  exercise_id: string
  exercise_title: string
  sets: string
  reps: string
  load: string
  tempo: string
  rest: string
  notes: string
}

interface WorkoutDraft {
  id: string
  title: string
  day_of_week: number
  notes: string
  exercises: ExerciseDraft[]
}

interface BlockDraft {
  id: string
  title: string
  week_number: number
  collapsed: boolean
  workouts: WorkoutDraft[]
}

let uid = 0
const nextId = () => `draft-${++uid}`

export default function NewProgramPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [blocks, setBlocks] = useState<BlockDraft[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('exercises').select('*').order('title').then(({ data }) => {
      setExercises(data ?? [])
    })
  }, [])

  function addBlock() {
    setBlocks(prev => [
      ...prev,
      {
        id: nextId(),
        title: `Week ${prev.length + 1}`,
        week_number: prev.length + 1,
        collapsed: false,
        workouts: [],
      },
    ])
  }

  function removeBlock(blockId: string) {
    setBlocks(prev => prev.filter(b => b.id !== blockId))
  }

  function updateBlock(blockId: string, updates: Partial<BlockDraft>) {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, ...updates } : b))
  }

  function addWorkout(blockId: string) {
    setBlocks(prev => prev.map(b =>
      b.id === blockId
        ? { ...b, workouts: [...b.workouts, { id: nextId(), title: 'Workout', day_of_week: 1, notes: '', exercises: [] }] }
        : b
    ))
  }

  function removeWorkout(blockId: string, workoutId: string) {
    setBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, workouts: b.workouts.filter(w => w.id !== workoutId) } : b
    ))
  }

  function updateWorkout(blockId: string, workoutId: string, updates: Partial<WorkoutDraft>) {
    setBlocks(prev => prev.map(b =>
      b.id === blockId
        ? { ...b, workouts: b.workouts.map(w => w.id === workoutId ? { ...w, ...updates } : w) }
        : b
    ))
  }

  function addExerciseToWorkout(blockId: string, workoutId: string, exerciseId: string) {
    const ex = exercises.find(e => e.id === exerciseId)
    if (!ex) return
    setBlocks(prev => prev.map(b =>
      b.id === blockId
        ? {
            ...b,
            workouts: b.workouts.map(w =>
              w.id === workoutId
                ? {
                    ...w,
                    exercises: [
                      ...w.exercises,
                      { id: nextId(), exercise_id: ex.id, exercise_title: ex.title, sets: '3', reps: '8', load: '', tempo: '', rest: '60s', notes: '' },
                    ],
                  }
                : w
            ),
          }
        : b
    ))
  }

  function removeExerciseFromWorkout(blockId: string, workoutId: string, exId: string) {
    setBlocks(prev => prev.map(b =>
      b.id === blockId
        ? {
            ...b,
            workouts: b.workouts.map(w =>
              w.id === workoutId ? { ...w, exercises: w.exercises.filter(e => e.id !== exId) } : w
            ),
          }
        : b
    ))
  }

  function updateExercise(blockId: string, workoutId: string, exId: string, updates: Partial<ExerciseDraft>) {
    setBlocks(prev => prev.map(b =>
      b.id === blockId
        ? {
            ...b,
            workouts: b.workouts.map(w =>
              w.id === workoutId
                ? { ...w, exercises: w.exercises.map(e => e.id === exId ? { ...e, ...updates } : e) }
                : w
            ),
          }
        : b
    ))
  }

  async function handleSave() {
    if (!title.trim()) { setError('Program title is required'); return }
    setSaving(true)
    setError('')

    const result = await createProgram({
      title: title.trim(),
      description: description.trim(),
      blocks: blocks.map((b, bi) => ({
        title: b.title,
        week_number: b.week_number,
        order: bi,
        workouts: b.workouts.map(w => ({
          title: w.title,
          day_of_week: w.day_of_week,
          notes: w.notes,
          exercises: w.exercises.map((e, ei) => ({
            exercise_id: e.exercise_id,
            sets: e.sets,
            reps: e.reps,
            load: e.load,
            tempo: e.tempo,
            rest: e.rest,
            notes: e.notes,
            order: ei,
          })),
        })),
      })),
    })

    if (result?.error) {
      setError(result.error)
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/coach/programs" className="text-zinc-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">New Program</h1>
      </div>

      {/* Program Details */}
      <Card>
        <CardHeader>
          <CardTitle>Program Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Program Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. 8-Week Speed Development"
            required
          />
          <Textarea
            label="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What is this program designed to accomplish?"
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Training Blocks */}
      <div className="space-y-4">
        {blocks.map((block, bi) => (
          <Card key={block.id}>
            <CardHeader className="flex flex-row items-center gap-3">
              <GripVertical className="w-4 h-4 text-zinc-600 shrink-0" />
              <div className="flex-1 flex items-center gap-3">
                <input
                  value={block.title}
                  onChange={e => updateBlock(block.id, { title: e.target.value })}
                  className="bg-transparent text-sm font-semibold text-white focus:outline-none flex-1 min-w-0"
                  placeholder="Block title"
                />
                <input
                  type="number"
                  value={block.week_number}
                  onChange={e => updateBlock(block.id, { week_number: parseInt(e.target.value) })}
                  className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white w-16 focus:outline-none"
                  placeholder="Week"
                  min={1}
                />
              </div>
              <button onClick={() => updateBlock(block.id, { collapsed: !block.collapsed })} className="text-zinc-500 hover:text-white p-1">
                {block.collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              <button onClick={() => removeBlock(block.id)} className="text-zinc-600 hover:text-red-400 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </CardHeader>

            {!block.collapsed && (
              <CardContent className="space-y-4 pt-0">
                {block.workouts.map(workout => (
                  <div key={workout.id} className="border border-zinc-800 rounded-xl p-4 space-y-4 bg-zinc-950/50">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex gap-3">
                        <input
                          value={workout.title}
                          onChange={e => updateWorkout(block.id, workout.id, { title: e.target.value })}
                          className="bg-transparent text-sm font-medium text-white focus:outline-none flex-1"
                          placeholder="Workout name"
                        />
                        <select
                          value={workout.day_of_week}
                          onChange={e => updateWorkout(block.id, workout.id, { day_of_week: parseInt(e.target.value) })}
                          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                        >
                          {DAYS_OF_WEEK.map((d, i) => (
                            <option key={d} value={i}>{d}</option>
                          ))}
                        </select>
                      </div>
                      <button onClick={() => removeWorkout(block.id, workout.id)} className="text-zinc-600 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Exercises */}
                    {workout.exercises.map((ex, ei) => (
                      <div key={ex.id} className="bg-zinc-900 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-white">{ei + 1}. {ex.exercise_title}</span>
                          <button onClick={() => removeExerciseFromWorkout(block.id, workout.id, ex.id)} className="text-zinc-600 hover:text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                          {[
                            { key: 'sets', label: 'Sets', placeholder: '3' },
                            { key: 'reps', label: 'Reps', placeholder: '8' },
                            { key: 'load', label: 'Load', placeholder: 'BW' },
                            { key: 'tempo', label: 'Tempo', placeholder: '2-0-2' },
                            { key: 'rest', label: 'Rest', placeholder: '60s' },
                          ].map(({ key, label, placeholder }) => (
                            <div key={key}>
                              <label className="text-[10px] text-zinc-500 uppercase">{label}</label>
                              <input
                                value={(ex as Record<string, string>)[key]}
                                onChange={e => updateExercise(block.id, workout.id, ex.id, { [key]: e.target.value })}
                                placeholder={placeholder}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 mt-0.5"
                              />
                            </div>
                          ))}
                        </div>
                        <input
                          value={ex.notes}
                          onChange={e => updateExercise(block.id, workout.id, ex.id, { notes: e.target.value })}
                          placeholder="Notes (optional)"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    ))}

                    {/* Add exercise */}
                    <div className="flex gap-2">
                      <select
                        onChange={e => { if (e.target.value) { addExerciseToWorkout(block.id, workout.id, e.target.value); e.target.value = '' } }}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-400 focus:outline-none"
                        defaultValue=""
                      >
                        <option value="">+ Add exercise…</option>
                        {EXERCISE_CATEGORIES.map(cat => (
                          <optgroup key={cat} label={cat}>
                            {exercises.filter(e => e.category === cat).map(e => (
                              <option key={e.id} value={e.id}>{e.title}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => addWorkout(block.id)}
                  className="w-full border border-dashed border-zinc-700 rounded-xl py-2.5 text-sm text-zinc-500 hover:text-white hover:border-zinc-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Workout
                </button>
              </CardContent>
            )}
          </Card>
        ))}

        <button
          onClick={addBlock}
          className="w-full border border-dashed border-zinc-700 rounded-xl py-4 text-sm text-zinc-500 hover:text-white hover:border-zinc-500 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Training Block
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3 pb-8">
        <Link href="/coach/programs">
          <Button variant="secondary">Cancel</Button>
        </Link>
        <Button onClick={handleSave} loading={saving}>
          Save Program
        </Button>
      </div>
    </div>
  )
}
