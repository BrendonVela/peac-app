'use server'

import { createClient } from '@/lib/supabase/server'
import type { AnalysisResult, PoseFrame } from '@/lib/pose/analysis'

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
