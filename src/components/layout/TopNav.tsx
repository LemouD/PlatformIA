'use client'

import { Bell } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { NAV_ITEMS, isNavItemActive } from '@/config/navigation'
import type { Theme } from '@/config/theme'
import type { SystemHealth } from '@/domain/types'
import { ThemeSwitcher } from './ThemeSwitcher'

const HEALTH_LABEL: Record<SystemHealth, string> = {
  nominal: 'System nominal',
  degraded: 'System degraded',
}

const HEALTH_SHORT: Record<SystemHealth, string> = {
  nominal: 'OK',
  degraded: 'Degraded',
}

const HEALTH_DOT: Record<SystemHealth, string> = {
  nominal: 'bg-success',
  degraded: 'bg-warning',
}

interface TopNavProps {
  health: SystemHealth
  userInitials: string
  theme: Theme
}

function Brand() {
  return (
    <Link href="/" aria-label="AI OS home" className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex size-[31px] items-center justify-center rounded-control bg-linear-to-b from-brass-light to-accent text-[11px] font-extrabold text-canvas shadow-glow"
      >
        AI
      </span>
      <span className="text-base font-bold text-ink">AI OS</span>
    </Link>
  )
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span
      role="img"
      aria-label="Account"
      className="flex size-[34px] items-center justify-center rounded-full bg-linear-to-b from-avatar-from to-avatar-to text-[10px] font-bold text-white"
    >
      {initials}
    </span>
  )
}

/** Desktop account menu: the avatar opens a small panel holding the theme switcher. */
function AccountMenu({ initials, theme }: { initials: string; theme: Theme }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Account"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className="flex size-[34px] items-center justify-center rounded-full bg-linear-to-b from-avatar-from to-avatar-to text-[10px] font-bold text-white"
      >
        {initials}
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 flex w-[320px] flex-col gap-2 rounded-card border border-line-strong bg-surface p-3 shadow-panel">
          <p className="font-mono text-[10px] uppercase text-ink-muted">Appearance</p>
          <ThemeSwitcher initialTheme={theme} />
        </div>
      ) : null}
    </div>
  )
}

export function TopNav({ health, userInitials, theme }: TopNavProps) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-nav backdrop-blur">
      {/* Desktop and tablet */}
      <div className="hidden h-[72px] items-center justify-between px-9 md:flex">
        <div className="flex items-center gap-[34px]">
          <Brand />
          <nav aria-label="Primary">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isNavItemActive(pathname, item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`block rounded-control px-[11px] py-2 text-[11px] transition-colors ${
                        active
                          ? 'bg-surface-raised font-semibold text-ink'
                          : 'text-ink-muted hover:text-ink-soft'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-[11px]">
          <p className="flex items-center gap-[7px] rounded-full bg-surface px-2.5 py-[7px] font-mono text-[9px] font-semibold uppercase text-ink-soft">
            <span aria-hidden className={`size-1.5 rounded-full ${HEALTH_DOT[health]}`} />
            {HEALTH_LABEL[health]}
          </p>
          <button
            type="button"
            aria-label="Notifications"
            className="flex size-[34px] items-center justify-center rounded-control bg-surface text-ink-soft"
          >
            <Bell aria-hidden size={14} />
          </button>
          <AccountMenu initials={userInitials} theme={theme} />
        </div>
      </div>

      {/* Phone: the sections move to the bottom tab bar */}
      <div className="flex h-14 items-center justify-between px-4 md:hidden">
        <Brand />
        <div className="flex items-center gap-2">
          <p
            className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase text-ink-soft"
            aria-label={HEALTH_LABEL[health]}
          >
            <span aria-hidden className={`size-1.5 rounded-full ${HEALTH_DOT[health]}`} />
            {HEALTH_SHORT[health]}
          </p>
          <button
            type="button"
            aria-label="Notifications"
            className="flex size-11 items-center justify-center rounded-control bg-surface text-ink-soft"
          >
            <Bell aria-hidden size={18} />
          </button>
          <Avatar initials={userInitials} />
        </div>
      </div>
    </header>
  )
}
