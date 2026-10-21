import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PEAC — Performance Training',
  description: 'Elite performance coaching tools for coaches and athletes.',
  applicationName: 'PEAC',
  appleWebApp: {
    capable: true,
    title: 'PEAC',
    statusBarStyle: 'black',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
