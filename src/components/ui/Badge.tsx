import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'blue' | 'green' | 'yellow' | 'red' | 'purple'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        {
          'bg-zinc-800 text-zinc-300 border-zinc-700': variant === 'default',
          'bg-blue-500/10 text-blue-400 border-blue-500/20': variant === 'blue',
          'bg-green-500/10 text-green-400 border-green-500/20': variant === 'green',
          'bg-yellow-500/10 text-yellow-400 border-yellow-500/20': variant === 'yellow',
          'bg-red-500/10 text-red-400 border-red-500/20': variant === 'red',
          'bg-purple-500/10 text-purple-400 border-purple-500/20': variant === 'purple',
        },
        className
      )}
      {...props}
    />
  )
}
