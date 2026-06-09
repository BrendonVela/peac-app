import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PEAC — Performance Training',
  description: 'Elite performance coaching tools for coaches and athletes.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
