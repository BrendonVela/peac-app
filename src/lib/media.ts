// Background video clips. Drop .mp4 files in /public/videos and put their path here.
// Leave a clip as null to show the animated color background instead.
// Tip: keep clips short (5–10 sec), no sound, under ~3 MB each.
export type ClipKey = 'login' | 'home' | 'done' | 'coach'

export const CLIPS: Record<ClipKey, string | null> = {
  login: null, // e.g. '/videos/login.mp4'  (sprint start)
  home: null,  // e.g. '/videos/home.mp4'   (heavy lift)
  done: null,  // e.g. '/videos/done.mp4'   (team huddle / celebration)
  coach: null, // e.g. '/videos/coach.mp4'  (team training)
}
