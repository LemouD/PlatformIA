import type { Metadata, Viewport } from 'next'
import { Bodoni_Moda, IBM_Plex_Mono, Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { TopNav } from '@/components/layout/TopNav'
import { parseTheme, THEME_COOKIE } from '@/config/theme'
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The theme comes from a cookie and is written into the first HTML: no flash, no inline script.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value)

  return (
    <html lang="en" data-theme={theme} className={`${inter.variable} ${plexMono.variable} ${bodoni.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <TopNav health={mockSession.health} userInitials={mockSession.userInitials} theme={theme} />
        <main className="pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-0">
          <SystemProvider>{children}</SystemProvider>
        </main>
        <MobileTabBar userInitials={mockSession.userInitials} theme={theme} />
        <div aria-hidden className="film-grain" />
      </body>
    </html>
  )
}
