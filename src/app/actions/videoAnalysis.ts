'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push'
import type { AnalysisResult, PoseFrame } from '@/lib/pose/analysis'
import type { Annotations } from '@/lib/pose/annotations'

/** Save the form-analysis results for a video so it opens instantly next time */
export async function saveVideoAnalysis(videoPath: string, result: AnalysisResult, frames: PoseFrame[]) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase.from('video_analyses').upsert(
    {
      video_path: videoPath,
      exercise: result.exercise,
      view: result.view,
      result,
      frames,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'video_path' }
  )
  if (error) return { error: error.message }
  return { ok: true }
}

/** Save coach drawings + notes for a video */
export async function saveVideoNotes(videoPath: string, notes: Annotations) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase.from('video_analyses').upsert(
    { video_path: videoPath, annotations: notes, updated_at: new Date().toISOString() },
    { onConflict: 'video_path' }
  )
  if (error) return { error: error.message }
  return { ok: true }
}

/** Send the reviewed video (with notes) back to the other person in the conversation */
export async function sendVideoReview(videoPath: string, noteCount: number, comment: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { data: orig } = await supabase
    .from('messages')
    .select('sender_id, receiver_id, attachment_type')
    .eq('attachment_path', videoPath)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (!orig) return { error: 'Could not find who sent this video.' }
  const to = orig.sender_id === user.id ? orig.receiver_id : orig.sender_id
  const content = `📝 Video review — ${noteCount} note${noteCount === 1 ? '' : 's'}${comment.trim() ? `\n${comment.trim()}` : ''}\nTap “Watch review” to see it.`
  const { data: row, error } = await supabase
    .from('messages')
    .insert({ sender_id: user.id, receiver_id: to, content, attachment_path: videoPath, attachment_type: orig.attachment_type ?? 'video/mp4' })
    .select('*')
    .single()
  if (error) return { error: error.message }

  const admin = createAdminClient()
  if (admin) {
    const [{ data: coach }, { data: receiverAthlete }] = await Promise.all([
      admin.from('coaches').select('name').eq('user_id', user.id).maybeSingle(),
      admin.from('athletes').select('id').eq('user_id', to).maybeSingle(),
    ])
    await sendPushToUsers([to], {
      title: coach ? `Coach ${coach.name} reviewed your video` : 'Your video was reviewed',
      body: `${noteCount} note${noteCount === 1 ? '' : 's'} — tap to watch`,
      url: receiverAthlete ? '/athlete/messages' : '/coach/messages',
    }).catch(() => {})
  }
  revalidatePath('/coach/messages')
  revalidatePath('/athlete/messages')
  return { ok: true, message: row }
}
