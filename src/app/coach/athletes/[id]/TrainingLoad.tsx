import { Gauge, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { weeklyLoad, loadRatio, sessionLoad, type SessionRow } from '@/lib/load'
import { formatMonthDay, toLocalISO } from '@/lib/schedule'
import { cn } from '@/lib/utils'

export function TrainingLoad({ sessions }: { sessions: SessionRow[] }) {
  const weeks = weeklyLoad(sessions, 6)
  const max = Math.max(1, ...weeks.map(w => w.load))
  const ratio = loadRatio(weeks)
  const recent = [...sessions].sort((a, b) => b.completed_at.localeCompare(a.completed_at)).slice(0, 5)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Gauge className="w-4 h-4 text-blue-400" /> Effort & training load</CardTitle>
        <p className="text-xs text-zinc-500 mt-1">After each workout the athlete rates it 1–10 and enters minutes. Load = rating × minutes.</p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {sessions.length === 0 ? (
          <p className="text-sm text-zinc-500">No ratings yet. Athletes rate a workout on the finish screen.</p>
        ) : (
          <>
            <div className="flex items-end gap-2 h-28">
              {weeks.map((w, i) => (
                <div key={w.weekStart} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <span className="text-[10px] text-zinc-400 tabular-nums">{w.load || ''}</span>
                  <div
                    className={cn('w-full rounded-t', i === weeks.length - 1 ? 'bg-blue-500' : 'bg-zinc-700')}
                    style={{ height: `${Math.max(2, (w.load / max) * 100)}%` }}
                    title={`${w.sessions} sessions · avg RPE ${w.avgRpe ?? '—'}`}
                  />
                  <span className="text-[10px] text-zinc-500">{formatMonthDay(w.weekStart)}</span>
                </div>
              ))}
            </div>
            {ratio !== null && ratio >= 1.5 && (
              <p className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                This week&apos;s load is {ratio}× the average of the last 3 weeks. Big jumps raise injury risk — consider backing off.
              </p>
            )}
            <div className="divide-y divide-zinc-800 border-t border-zinc-800">
              {recent.map(s => (
                <div key={s.workout_id + s.completed_at} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-14 text-xs text-zinc-500">{formatMonthDay(toLocalISO(s.completed_at))}</span>
                  <span className="flex-1 min-w-0 truncate text-zinc-200">
                    {s.workouts?.title ?? 'Workout'}
                    {s.notes && <span className="block text-xs text-zinc-500 italic truncate">&ldquo;{s.notes}&rdquo;</span>}
                  </span>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded',
                    s.rpe <= 4 ? 'bg-green-600/20 text-green-300' : s.rpe <= 7 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-600/20 text-red-300')}>
                    RPE {s.rpe}
                  </span>
                  <span className="w-16 text-right text-xs text-zinc-400 tabular-nums">{s.minutes ? `${s.minutes} min` : '—'}</span>
                  <span className="w-14 text-right text-xs text-zinc-300 tabular-nums">{sessionLoad(s) ?? '—'}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
