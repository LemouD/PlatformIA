import type { Metadata, Viewport } from 'next'
import { Bodoni_Moda, IBM_Plex_Mono, Inter } from 'next/font/google'
import type { ReactNode } from 'react'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { TopNav } from '@/components/layout/TopNav'
import { mockSession } from '@/mocks/session'
import { SystemProvider } from '@/store/SystemProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-plex-mono',
})
const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  style: ['italic'],
  axes: ['opsz'],
  variable: '--font-bodoni',
})

export const metadata: Metadata = {
  title: { default: 'AI OS', template: '%s · AI OS' },
  description: 'Personal AI command center',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#12050a',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable} ${bodoni.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <TopNav health={mockSession.health} userInitials={mockSession.userInitials} />
        <main className="pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-0">
          <SystemProvider>{children}</SystemProvider>
        </main>
        <MobileTabBar userInitials={mockSession.userInitials} />
        <div aria-hidden className="film-grain" />
      </body>
    </html>
  )
}
