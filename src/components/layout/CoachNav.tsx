'use client'

import {
  LayoutDashboard, Users, BookOpen, Dumbbell,
  MessageCircle, Settings, ShieldCheck, Trophy, ClipboardCheck, Tablet, Timer, ClipboardList, UserCog,
} from 'lucide-react'
import { AppNav, type NavItem } from './AppNav'

const nav: NavItem[] = [
  { href: '/coach/dashboard', icon: LayoutDashboard, label: 'Dashboard', short: 'Home' },
  { href: '/coach/athletes',  icon: Users,           label: 'Athletes' },
  { href: '/coach/programs',  icon: BookOpen,        label: 'Programs' },
  { href: '/coach/exercises', icon: Dumbbell,        label: 'Exercises' },
  { href: '/coach/messages',  icon: MessageCircle,   label: 'Messages' },
  { href: '/coach/leaderboard', icon: Trophy,        label: 'Leaderboard' },
  { href: '/coach/reports',   icon: ClipboardCheck,  label: 'Reports' },
  { href: '/coach/forms',     icon: ClipboardList,   label: 'Forms' },
  { href: '/kiosk',           icon: Tablet,          label: 'Weight room' },
  { href: '/coach/timer',     icon: Timer,           label: 'Timer' },
  { href: '/coach/staff',     icon: UserCog,         label: 'Staff' },
  { href: '/coach/settings',  icon: Settings,        label: 'Settings' },
]

export function CoachNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const items = isAdmin ? [...nav, { href: '/coach/admin', icon: ShieldCheck, label: 'Admin' }] : nav
  return (
    <AppNav
      items={items}
      tabs={['/coach/dashboard', '/coach/athletes', '/coach/programs', '/coach/messages']}
    />
  )
}
