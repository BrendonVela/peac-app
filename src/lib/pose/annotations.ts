// Coach drawings + notes pinned to a moment in a video.
// Points are stored 0..1 across the video picture, so they line up on any screen size.

export type Tool = 'pen' | 'line' | 'arrow' | 'circle' | 'angle'
export interface Stroke { tool: Tool; color: string; pts: [number, number][] }
export interface VideoNote { id: string; t: number; text: string; strokes: Stroke[]; by?: string }

export const PEN_COLORS = ['#facc15', '#ef4444', '#22c55e', '#ffffff', '#38bdf8']
/** How long (video seconds) a note stays on screen after its moment */
export const NOTE_SHOW_SECS = 1.5

export interface Rect { dw: number; dh: number; ox: number; oy: number; va: number }

function angleAt(a: [number, number], b: [number, number], c: [number, number], va: number) {
  const ax = (a[0] - b[0]) * va, ay = a[1] - b[1], cx = (c[0] - b[0]) * va, cy = c[1] - b[1]
  const d = Math.hypot(ax, ay) * Math.hypot(cx, cy)
  if (!d) return null
  return (Math.acos(Math.max(-1, Math.min(1, (ax * cx + ay * cy) / d))) * 180) / Math.PI
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, r: Rect) {
  const X = (p: [number, number]) => r.ox + p[0] * r.dw
  const Y = (p: [number, number]) => r.oy + p[1] * r.dh
  ctx.save()
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 3
  const p = s.pts
  if (!p.length) { ctx.restore(); return }
  if (s.tool === 'pen') {
    ctx.beginPath(); ctx.moveTo(X(p[0]), Y(p[0]))
    for (const q of p.slice(1)) ctx.lineTo(X(q), Y(q))
    if (p.length === 1) ctx.lineTo(X(p[0]) + 0.1, Y(p[0]))
    ctx.stroke()
  } else if ((s.tool === 'line' || s.tool === 'arrow') && p.length >= 2) {
    const a = p[0], b = p[p.length - 1]
    ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke()
    if (s.tool === 'arrow') {
      const ang = Math.atan2(Y(b) - Y(a), X(b) - X(a)), L = 14
      ctx.beginPath()
      ctx.moveTo(X(b), Y(b)); ctx.lineTo(X(b) - L * Math.cos(ang - 0.45), Y(b) - L * Math.sin(ang - 0.45))
      ctx.moveTo(X(b), Y(b)); ctx.lineTo(X(b) - L * Math.cos(ang + 0.45), Y(b) - L * Math.sin(ang + 0.45))
      ctx.stroke()
    }
  } else if (s.tool === 'circle' && p.length >= 2) {
    const a = p[0], b = p[p.length - 1]
    const rad = Math.hypot(X(b) - X(a), Y(b) - Y(a))
    ctx.beginPath(); ctx.arc(X(a), Y(a), rad, 0, Math.PI * 2); ctx.stroke()
  } else if (s.tool === 'angle') {
    // 3 taps: end, corner, end — shows the degrees at the corner
    ctx.beginPath(); ctx.moveTo(X(p[0]), Y(p[0]))
    for (const q of p.slice(1, 3)) ctx.lineTo(X(q), Y(q))
    ctx.stroke()
    for (const q of p.slice(0, 3)) { ctx.beginPath(); ctx.arc(X(q), Y(q), 4, 0, Math.PI * 2); ctx.fill() }
    if (p.length >= 3) {
      const deg = angleAt(p[0], p[1], p[2], r.va)
      if (deg != null) {
        const text = `${Math.round(deg)}°`
        ctx.shadowBlur = 0
        ctx.font = '700 14px Inter, system-ui, sans-serif'
        const w = ctx.measureText(text).width + 12
        const bx = X(p[1]) + 10, by = Y(p[1]) - 26
        ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(bx, by, w, 22)
        ctx.fillStyle = s.color; ctx.fillText(text, bx + 6, by + 16)
      }
    }
  }
  ctx.restore()
}

/** Notes showing at video time t */
export function notesAt(notes: VideoNote[], t: number) {
  return notes.filter(n => t >= n.t - 0.04 && t < n.t + NOTE_SHOW_SECS)
}
