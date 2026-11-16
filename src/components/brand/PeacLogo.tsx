import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const SIZES: Record<Size, { box: string; icon: string; text: string }> = {
  sm: { box: 'w-8 h-8 rounded-lg', icon: 'w-[18px] h-[18px]', text: 'text-2xl' },
  md: { box: 'w-9 h-9 rounded-[10px]', icon: 'w-5 h-5', text: 'text-[30px]' },
  lg: { box: 'w-11 h-11 rounded-xl', icon: 'w-6 h-6', text: 'text-4xl' },
  xl: { box: 'w-20 h-20 rounded-[22px]', icon: 'w-11 h-11', text: 'text-7xl' },
}

/** The PEAC mark: bolt in a colored tile (turns the coach's color when branded) */
export function PeacMark({ size = 'md', className }: { size?: Size; className?: string }) {
  const s = SIZES[size]
  return (
    <span className={cn('inline-flex items-center justify-center bg-blue-500 shrink-0', s.box, className)}>
      <Zap className={cn('text-ink fill-ink', s.icon)} />
    </span>
  )
}

/** Mark + "PEAC" wordmark. `stacked` puts the mark above the word (login screen). */
export function PeacLogo({ size = 'md', stacked = false, name, className }: {
  size?: Size; stacked?: boolean; name?: string | null; className?: string
}) {
  const s = SIZES[size]
  return (
    <span className={cn('inline-flex items-center min-w-0', stacked ? 'flex-col gap-4' : 'gap-3', className)}>
      <PeacMark size={size} />
      <span className={cn('font-display font-extrabold uppercase leading-none tracking-[0.06em] truncate', s.text)}>
        {name || 'PEAC'}
      </span>
    </span>
  )
}
