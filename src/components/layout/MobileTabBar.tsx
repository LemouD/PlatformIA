'use client'

import { BookOpen, Bot, Brain, Ellipsis, LayoutDashboard, ListChecks, ScrollText, Wrench, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef } from 'react'
import { isMoreActive, isNavItemActive, MOBILE_TABS, MORE_ITEMS } from '@/config/navigation'
import type { Theme } from '@/config/theme'
import { ThemeSwitcher } from './ThemeSwitcher'

const TAB_ICONS: Record<string, LucideIcon> = {
  '/': LayoutDashboard,
  '/agents': Bot,
  '/tasks': ListChecks,
  '/logs': ScrollText,
}

const MORE_ICONS: Record<string, LucideIcon> = {
  '/memory': Brain,
  '/knowledge': BookOpen,
  '/tools': Wrench,
}

const TAB_CLASS = 'flex h-[52px] w-[66px] flex-col items-center justify-center gap-1 rounded-card text-[11px]'
const TAB_ACTIVE = 'bg-surface-raised text-brass-light'
const TAB_IDLE = 'text-ink-muted'

interface MobileTabBarProps {
  userInitials: string
  theme: Theme
}

/** Bottom tab bar shown below 768 px, with a "More" sheet for the remaining sections. */
export function MobileTabBar({ userInitials, theme }: MobileTabBarProps) {
  const pathname = usePathname()
  const sheet = useRef<HTMLDialogElement>(null)
  const moreActive = isMoreActive(pathname)

  const close = () => sheet.current?.close()

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-nav pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="flex items-center justify-around px-2 py-1">
          {MOBILE_TABS.map((tab) => {
            const active = isNavItemActive(pathname, tab.href)
            const Icon = TAB_ICONS[tab.href] ?? LayoutDashboard
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`${TAB_CLASS} ${active ? TAB_ACTIVE : TAB_IDLE}`}
                >
                  <Icon aria-hidden size={22} />
                  {tab.label}
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => sheet.current?.showModal()}
              className={`${TAB_CLASS} ${moreActive ? TAB_ACTIVE : TAB_IDLE}`}
            >
              <Ellipsis aria-hidden size={22} />
              More
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={sheet}
        aria-label="More sections"
        onClick={(event) => {
          if (event.target === event.currentTarget) close()
        }}
        className="mt-auto mb-0 w-full max-w-none rounded-t-[26px] border-t border-line-strong bg-surface p-0 text-ink backdrop:bg-[rgb(6_1_4/0.72)] md:hidden"
      >
        <div className="flex flex-col gap-2 px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-line-strong" />
          </div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg italic">More</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="flex size-11 items-center justify-center rounded-control text-ink-soft"
            >
              <X aria-hidden size={18} />
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {MORE_ITEMS.map((item) => {
              const Icon = MORE_ICONS[item.href] ?? Wrench
              const active = isNavItemActive(pathname, item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={active ? 'page' : undefined}
                    className={`flex h-12 items-center gap-3 rounded-card px-3 text-sm ${
                      active ? 'bg-surface-raised text-brass-light' : 'text-ink-soft'
                    }`}
                  >
                    <Icon aria-hidden size={18} />
                    {item.label}
                  </Link>
                </li>
              )
            })}
            <li className="mt-2 flex flex-col gap-2 border-t border-line px-1 pt-3">
              <span className="font-mono text-[11px] uppercase text-ink-muted">Appearance</span>
              <ThemeSwitcher initialTheme={theme} size="touch" />
            </li>
            <li className="flex h-12 items-center gap-3 px-3 text-sm text-ink-muted">
              <span
                aria-hidden
                className="flex size-7 items-center justify-center rounded-full bg-linear-to-b from-avatar-from to-avatar-to text-[10px] font-bold text-white"
              >
                {userInitials}
              </span>
              Account
            </li>
          </ul>
        </div>
      </dialog>
    </>
  )
}
