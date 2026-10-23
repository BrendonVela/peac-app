'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getActingCoachId } from './viewAs'
import { todayISO } from '@/lib/schedule'

export interface Group {
  id: string
  name: string
  athleteIds: string[]
}

function refresh() {
  revalidatePath('/coach/athletes')
  revalidatePath('/coach/reports')
  revalidatePath('/coach/leaderboard')
}

/** The acting coach's groups with their members */
export async function listGroups(): Promise<Group[]> {
  const supabase = createClient()
  const coachId = await getActingCoachId()
  if (!coachId) return []
  const { data } = await supabase
    .from('athlete_groups')
    .select('id, name, athlete_group_members(athlete_id)')
    .eq('coach_id', coachId)
    .order('name')
  return (data ?? []).map((g: any) => ({
    id: g.id,
    name: g.name,
    athleteIds: (g.athlete_group_members ?? []).map((m: any) => m.athlete_id),
  }))
}

export async function createGroup(name: string) {
  const supabase = createClient()
  const coachId = await getActingCoachId()
  if (!coachId) return { error: 'Coach not found' }
  const n = name.trim()
  if (!n) return { error: 'Give the group a name.' }
  const { data, error } = await supabase.from('athlete_groups').insert({ coach_id: coachId, name: n }).select('id').single()
  if (error) return { error: error.message }
  refresh()
  return { id: data.id as string }
}

export async function renameGroup(groupId: string, name: string) {
  const supabase = createClient()
  const n = name.trim()
  if (!n) return { error: 'Give the group a name.' }
  const { error } = await supabase.from('athlete_groups').update({ name: n }).eq('id', groupId)
  if (error) return { error: error.message }
  refresh()
  return { ok: true }
}

export async function deleteGroup(groupId: string) {
  const supabase = createClient()
  const { error } = await supabase.from('athlete_groups').delete().eq('id', groupId)
  if (error) return { error: error.message }
  refresh()
  return { ok: true }
}

/** Replace the group's members with exactly these athletes */
export async function setGroupMembers(groupId: string, athleteIds: string[]) {
  const supabase = createClient()
  const { error: delErr } = await supabase.from('athlete_group_members').delete().eq('group_id', groupId)
  if (delErr) return { error: delErr.message }
  if (athleteIds.length > 0) {
    const { error } = await supabase
      .from('athlete_group_members')
      .insert(athleteIds.map(athlete_id => ({ group_id: groupId, athlete_id })))
    if (error) return { error: error.message }
  }
  refresh()
  return { ok: true }
}

/** Assign a program to everyone in a group (keeps existing start dates) */
export async function assignProgramToGroup(programId: string, groupId: string) {
  const supabase = createClient()
  const { data: members, error: mErr } = await supabase
    .from('athlete_group_members')
    .select('athlete_id')
    .eq('group_id', groupId)
  if (mErr) return { error: mErr.message }
  const ids = (members ?? []).map((m: any) => m.athlete_id as string)
  if (ids.length === 0) return { error: 'That group has no athletes yet.' }

  const { data: existing } = await supabase
    .from('program_assignments')
    .select('athlete_id')
    .eq('program_id', programId)
    .in('athlete_id', ids)
  const already = new Set((existing ?? []).map((e: any) => e.athlete_id))
  const toAdd = ids.filter(id => !already.has(id))
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('program_assignments')
      .insert(toAdd.map(athlete_id => ({ program_id: programId, athlete_id, start_date: todayISO() })))
    if (error) return { error: error.message }
  }
  revalidatePath(`/coach/programs/${programId}`)
  return { ok: true, added: toAdd.length, ids }
}
