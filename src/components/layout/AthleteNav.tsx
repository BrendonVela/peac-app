'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Dumbbell, TrendingUp,
  Heart, MessageCircle, LogOut, Menu, X, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/app/actions/auth'

const nav = [
  { href: '/athlete/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/athlete/progress',  icon: TrendingUp,      label: 'Progress'  },
  { href: '/athlete/checkin',   icon: Heart,           label: 'Check-In'  },
  { href: '/athlete/messages',  icon: MessageCircle,   label: 'Messages'  },
]

export function AthleteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-60 bg-zinc-950 border-r border-zinc-800 z-40">
        <div className="flex items-center gap-2.5 px-6 h-16 border-b border-zinc-800 shrink-0">
          <Zap className="w-6 h-6 text-blue-500 fill-blue-500" />
          <span className="text-lg font-bold tracking-tight">PEAC</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-zinc-800 shrink-0">
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-zinc-950 border-b border-zinc-800 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-500 fill-blue-500" />
          <span className="text-base font-bold">PEAC</span>
        </div>
        <button onClick={() => setOpen(v => !v)} className="text-zinc-400 hover:text-white p-1">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 top-14 bg-zinc-950 z-30 px-3 py-3 space-y-0.5">
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors',
                  active ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            )
          })}
          <div className="pt-4 border-t border-zinc-800 mt-4">
            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
