import type { Metadata } from 'next'
import { IBM_Plex_Mono, Inter } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-plex-mono',
})

export const metadata: Metadata = {
  title: { default: 'AI OS', template: '%s · AI OS' },
  description: 'Personal AI command center',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <main>{children}</main>
      </body>
    </html>
  )
}
