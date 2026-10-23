'use client'

import {
  LayoutDashboard, TrendingUp, Heart, MessageCircle, Settings, CalendarDays, Trophy,
} from 'lucide-react'
import { AppNav, type NavItem } from './AppNav'

const nav: NavItem[] = [
  { href: '/athlete/dashboard', icon: LayoutDashboard, label: 'Dashboard', short: 'Home' },
  { href: '/athlete/calendar',  icon: CalendarDays,    label: 'Calendar' },
  { href: '/athlete/progress',  icon: TrendingUp,      label: 'Progress' },
  { href: '/athlete/checkin',   icon: Heart,           label: 'Check-In' },
  { href: '/athlete/messages',  icon: MessageCircle,   label: 'Messages' },
  { href: '/athlete/leaderboard', icon: Trophy,        label: 'Leaderboard' },
  { href: '/athlete/settings',  icon: Settings,        label: 'Settings' },
]

export function AthleteNav() {
  return (
    <AppNav
      items={nav}
      tabs={['/athlete/dashboard', '/athlete/calendar', '/athlete/checkin', '/athlete/messages']}
    />
  )
}
