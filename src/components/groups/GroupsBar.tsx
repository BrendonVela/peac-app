'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, Trash2, Check, Settings2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  listGroups, createGroup, renameGroup, deleteGroup, setGroupMembers, type Group,
} from '@/app/actions/groups'

interface Props {
  athletes: { id: string; name: string }[]
  selected: string | null
  onSelect: (groupId: string | null) => void
  /** Called whenever groups load or change */
  onGroups?: (groups: Group[]) => void
  /** Hide the Manage button (e.g. on read-only pages) */
  readOnly?: boolean
}

export function GroupsBar({ athletes, selected, onSelect, onGroups, readOnly = false }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [members, setMembers] = useState<Set<string>>(new Set())
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function reload() {
    const g = await listGroups()
    setGroups(g)
    onGroups?.(g)
    return g
  }

  useEffect(() => { reload() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startEdit(g: Group) {
    setEditing(g.id)
    setDraftName(g.name)
    setMembers(new Set(g.athleteIds))
    setError('')
  }

  async function add() {
    if (!newName.trim()) return
    setBusy(true); setError('')
    const res = await createGroup(newName)
    setBusy(false)
    if ('error' in res && res.error) { setError(res.error); return }
    setNewName('')
    const g = await reload()
    const created = g.find(x => 'id' in res && x.id === res.id)
    if (created) startEdit(created)
  }

  async function save() {
    if (!editing) return
    setBusy(true); setError('')
    const g = groups.find(x => x.id === editing)
    if (g && draftName.trim() && draftName.trim() !== g.name) {
      const r = await renameGroup(editing, draftName)
      if ('error' in r && r.error) { setError(r.error); setBusy(false); return }
    }
    const r = await setGroupMembers(editing, Array.from(members))
    setBusy(false)
    if ('error' in r && r.error) { setError(r.error); return }
    setEditing(null)
    await reload()
  }

  async function remove(id: string) {
    if (!confirm('Delete this group? The athletes stay on your roster.')) return
    setBusy(true)
    await deleteGroup(id)
    setBusy(false)
    if (selected === id) onSelect(null)
    setEditing(null)
    await reload()
  }

  function toggle(id: string) {
    setMembers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const chip = (active: boolean) =>
    cn(
      'shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
      active ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-zinc-700 text-zinc-400 hover:text-white'
    )

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Users className="w-4 h-4 text-zinc-500 shrink-0" />
        <button className={chip(selected === null)} onClick={() => onSelect(null)}>All</button>
        {groups.map(g => (
          <button key={g.id} className={chip(selected === g.id)} onClick={() => onSelect(g.id)}>
            {g.name} <span className="opacity-60">{g.athleteIds.length}</span>
          </button>
        ))}
        {!readOnly && (
          <button
            onClick={() => { setOpen(true); setEditing(null); setError('') }}
            className="shrink-0 flex items-center gap-1 rounded-full border border-dashed border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
          >
            {groups.length === 0 ? <><Plus className="w-3.5 h-3.5" /> Make groups</> : <><Settings2 className="w-3.5 h-3.5" /> Manage</>}
          </button>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit group' : 'Groups'}>
        {editing ? (
          <div className="space-y-4">
            <input
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{members.size} selected</span>
              <span className="space-x-3">
                <button className="hover:text-white" onClick={() => setMembers(new Set(athletes.map(a => a.id)))}>Select all</button>
                <button className="hover:text-white" onClick={() => setMembers(new Set())}>Clear</button>
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-800 divide-y divide-zinc-800">
              {athletes.map(a => (
                <button
                  key={a.id}
                  onClick={() => toggle(a.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-zinc-800/50"
                >
                  <span className={cn(
                    'w-5 h-5 rounded border flex items-center justify-center shrink-0',
                    members.has(a.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-600'
                  )}>
                    {members.has(a.id) && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="text-white truncate">{a.name}</span>
                </button>
              ))}
              {athletes.length === 0 && <p className="px-3 py-4 text-sm text-zinc-500">No athletes yet.</p>}
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex items-center gap-2">
              <button onClick={() => remove(editing)} className="p-2 text-zinc-500 hover:text-red-400" title="Delete group">
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Back</Button>
              <Button size="sm" onClick={save} loading={busy}>Save group</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Groups like &ldquo;Varsity&rdquo;, &ldquo;Pitchers&rdquo; or &ldquo;Morning lift&rdquo;. An athlete can be in more than one.
            </p>
            {groups.length > 0 && (
              <div className="rounded-lg border border-zinc-800 divide-y divide-zinc-800">
                {groups.map(g => (
                  <button key={g.id} onClick={() => startEdit(g)} className="w-full flex items-center justify-between px-3 py-3 text-left hover:bg-zinc-800/50">
                    <span className="text-sm text-white">{g.name}</span>
                    <span className="text-xs text-zinc-500">{g.athleteIds.length} athletes · Edit</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') add() }}
                placeholder="New group name"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button size="sm" onClick={add} loading={busy} disabled={!newName.trim()}>
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        )}
      </Modal>
    </>
  )
}
