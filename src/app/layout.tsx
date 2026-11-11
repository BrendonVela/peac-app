import type { Metadata, Viewport } from 'next'
import './globals.css'
import { OfflineSupport } from '@/components/OfflineSupport'

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
  // Android/Chrome version of "can run full screen" (the Apple one above is still needed for iPhone)
  other: { 'mobile-web-app-capable': 'yes' },
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
      <body>
        <OfflineSupport />
        {children}
      </body>
    </html>
  )
}
