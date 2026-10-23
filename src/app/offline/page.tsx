import { WifiOff } from 'lucide-react'

export const metadata = { title: 'Offline — PEAC' }

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-6 text-center">
      <div className="space-y-3 max-w-sm">
        <WifiOff className="w-10 h-10 text-zinc-500 mx-auto" />
        <h1 className="text-xl font-bold text-white">You&apos;re offline</h1>
        <p className="text-sm text-zinc-400">
          This page hasn&apos;t been opened on this phone yet, so it isn&apos;t saved for offline use. Pages you&apos;ve
          opened before — like today&apos;s workout — still work, and anything you log syncs when you&apos;re back online.
        </p>
        <a href="/" className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Try again</a>
      </div>
    </div>
  )
}
