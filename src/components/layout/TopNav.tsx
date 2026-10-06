'use client'

import { Bell } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isNavItemActive } from '@/config/navigation'
import type { SystemHealth } from '@/domain/types'

const HEALTH_LABEL: Record<SystemHealth, string> = {
  nominal: 'System nominal',
  degraded: 'System degraded',
}

const HEALTH_DOT: Record<SystemHealth, string> = {
  nominal: 'bg-success',
  degraded: 'bg-warning',
}

interface TopNavProps {
  health: SystemHealth
  userInitials: string
}

export function TopNav({ health, userInitials }: TopNavProps) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b border-line bg-nav px-9 backdrop-blur">
      <div className="flex items-center gap-[34px]">
        <Link href="/" aria-label="AI OS home" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-[31px] items-center justify-center rounded-control bg-linear-to-b from-brass-light to-accent text-[11px] font-extrabold text-canvas shadow-glow"
          >
            AI
          </span>
          <span className="text-base font-bold text-ink">AI OS</span>
        </Link>

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
        <span
          role="img"
          aria-label="Account"
          className="flex size-[34px] items-center justify-center rounded-full bg-linear-to-b from-avatar-from to-avatar-to text-[10px] font-bold text-white"
        >
          {userInitials}
        </span>
      </div>
    </header>
  )
}
