'use client'

import { useState } from 'react'
import { THEME_LABELS, THEME_SWATCHES, THEMES, themeCookie } from '@/config/theme'
import type { Theme } from '@/config/theme'

interface ThemeSwitcherProps {
  initialTheme: Theme
  /** Taller targets for the phone sheet. */
  size?: 'compact' | 'touch'
}

function applyTheme(theme: Theme) {
  document.cookie = themeCookie(theme, window.location.protocol === 'https:')
  const swap = () => {
    document.documentElement.dataset.theme = theme
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduced && typeof document.startViewTransition === 'function') document.startViewTransition(swap)
  else swap()
}

/** Segmented control between the two velvets; the choice is kept on this device. */
export function ThemeSwitcher({ initialTheme, size = 'compact' }: ThemeSwitcherProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const height = size === 'touch' ? 'h-11' : 'h-9'

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-1 rounded-control border border-line-control p-1">
      {THEMES.map((option) => {
        const selected = option === theme
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (selected) return
              setTheme(option)
              applyTheme(option)
            }}
            className={`flex ${height} items-center justify-center gap-2 rounded-[6px] px-2 text-xs ${
              selected ? 'bg-surface-raised text-brass-light ring-1 ring-accent' : 'text-ink-soft'
            }`}
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full border border-line-control"
              style={{ background: THEME_SWATCHES[option] }}
            />
            {THEME_LABELS[option]}
          </button>
        )
      })}
    </div>
  )
}
