'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogOut, MoreHorizontal, X, Zap, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/app/actions/auth'

export type NavItem = { href: string; icon: LucideIcon; label: string; short?: string }

/**
 * Desktop: left sidebar with every item.
 * Phone: slim top bar + bottom tab bar (first 4 `tabs`) + a "More" sheet with everything else.
 */
export interface NavBrand { name: string | null; logoUrl: string | null }

function Logo({ brand, size }: { brand?: NavBrand | null; size: 'sm' | 'lg' }) {
  const box = size === 'lg' ? 'h-8 max-w-[7rem]' : 'h-7 max-w-[6rem]'
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {brand?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logoUrl} alt="" className={`${box} w-auto object-contain`} />
      ) : (
        <Zap className={size === 'lg' ? 'w-6 h-6 text-blue-500 fill-blue-500' : 'w-5 h-5 text-blue-500 fill-blue-500'} />
      )}
      <span className={`${size === 'lg' ? 'text-lg' : 'text-base'} font-bold tracking-tight truncate`}>{brand?.name || 'PEAC'}</span>
    </div>
  )
}

export function AppNav({ items, tabs, brand = null }: { items: NavItem[]; tabs: string[]; brand?: NavBrand | null }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  // Close the sheet whenever the page changes
  useEffect(() => { setMoreOpen(false) }, [pathname])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const tabItems = tabs.map(h => items.find(i => i.href === h)).filter(Boolean) as NavItem[]
  const moreItems = items.filter(i => !tabs.includes(i.href))
  const moreActive = moreItems.some(i => isActive(i.href))

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-60 bg-zinc-950 border-r border-zinc-800 z-40">
        <div className="flex items-center px-6 h-16 border-b border-zinc-800 shrink-0">
          <Logo brand={brand} size="lg" />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {items.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive(href) ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-zinc-800 shrink-0">
          {brand && <p className="px-3 pb-2 text-[10px] uppercase tracking-wider text-zinc-600">Powered by PEAC</p>}
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

      {/* Phone: top bar */}
      <header className="mobile-header md:hidden fixed top-0 inset-x-0 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 z-40 flex items-center px-4">
        <Logo brand={brand} size="sm" />
      </header>

      {/* Phone: "More" sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="tabbar-offset absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-zinc-800 bg-zinc-900 px-3 pt-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">More</span>
              <button onClick={() => setMoreOpen(false)} className="p-1 text-zinc-400 hover:text-white" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            {moreItems.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-3.5 rounded-xl text-base font-medium transition-colors',
                  isActive(href) ? 'bg-blue-600 text-white' : 'text-zinc-300 active:bg-zinc-800'
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            ))}
            <form action={signOut} className="mt-2 border-t border-zinc-800 pt-2 pb-3">
              <button
                type="submit"
                className="flex items-center gap-3 w-full px-3 py-3.5 rounded-xl text-base font-medium text-zinc-400 active:bg-zinc-800"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Phone: bottom tab bar */}
      <nav className="tabbar md:hidden fixed bottom-0 inset-x-0 z-50 bg-zinc-950/95 backdrop-blur border-t border-zinc-800">
        <div className="grid grid-cols-5 h-16">
          {tabItems.map(({ href, icon: Icon, label, short }) => {
            const active = isActive(href) && !moreOpen
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-blue-400' : 'text-zinc-500 active:text-zinc-300'
                )}
              >
                <Icon className="w-6 h-6" />
                {short ?? label}
              </Link>
            )
          })}
          <button
            onClick={() => setMoreOpen(v => !v)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
              moreOpen || moreActive ? 'text-blue-400' : 'text-zinc-500 active:text-zinc-300'
            )}
          >
            <MoreHorizontal className="w-6 h-6" />
            More
          </button>
        </div>
      </nav>
    </>
  )
}
