import { IntervalTimer } from '@/components/timer/IntervalTimer'

export default function TimerPage() {
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">Timer</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Intervals, EMOM, Tabata and a stopwatch for conditioning and sprints.</p>
      </div>
      <IntervalTimer />
    </div>
  )
}
