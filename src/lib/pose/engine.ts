'use client'

// Loads the body-tracking engine that lives in /public/mediapipe/pose (part of PEAC — nothing outside is called)
// and turns a video into a list of PoseFrames.

import { JOINTS, JOINT_NAMES, type PoseFrame } from './analysis'

const BASE = '/mediapipe/pose/'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PoseEngine = any

let enginePromise: Promise<PoseEngine> | null = null
let resolver: ((r: any) => void) | null = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-peac="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.dataset.peac = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load the form-analysis engine.'))
    document.head.appendChild(s)
  })
}

export function loadPoseEngine(): Promise<PoseEngine> {
  if (enginePromise) return enginePromise
  enginePromise = (async () => {
    await loadScript(`${BASE}pose.js`)
    const PoseCtor = (window as any).Pose
    if (!PoseCtor) throw new Error('Form-analysis engine did not start.')
    const pose = new PoseCtor({ locateFile: (file: string) => `${BASE}${file}` })
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
    pose.onResults((r: any) => { resolver?.(r); resolver = null })
    await pose.initialize()
    return pose
  })()
  enginePromise.catch(() => { enginePromise = null })
  return enginePromise
}

async function detect(pose: PoseEngine, image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) {
  const done = new Promise<any>(r => { resolver = r })
  await pose.send({ image })
  return done
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise(resolve => {
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve() }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = Math.max(0.001, t)
    setTimeout(() => { video.removeEventListener('seeked', onSeeked); resolve() }, 1500)
  })
}

const r3 = (n: number) => Math.round(n * 1000) / 1000
const r2 = (n: number) => Math.round(n * 100) / 100

/** Step through the video and find the body in each frame */
export async function extractPose(
  video: HTMLVideoElement,
  opts: { fps?: number; onProgress?: (share: number) => void; signal?: { cancelled: boolean } } = {}
): Promise<PoseFrame[]> {
  const pose = await loadPoseEngine()
  pose.reset?.()
  const fps = opts.fps ?? 15
  const duration = video.duration
  if (!isFinite(duration) || duration <= 0) throw new Error('Could not read the video length.')
  const frames: PoseFrame[] = []
  const steps = Math.max(1, Math.floor(duration * fps))
  for (let i = 0; i <= steps; i++) {
    if (opts.signal?.cancelled) break
    const t = Math.min(duration - 0.01, i / fps)
    await seek(video, t)
    const res = await detect(pose, video)
    const lm = res?.poseLandmarks as { x: number; y: number; visibility?: number }[] | undefined
    frames.push({
      t: r3(t),
      p: JOINT_NAMES.map(n => {
        const p = lm?.[JOINTS[n]]
        return p ? [r3(p.x), r3(p.y), r2(p.visibility ?? 0)] as [number, number, number] : null
      }),
    })
    opts.onProgress?.(i / steps)
  }
  return frames
}
