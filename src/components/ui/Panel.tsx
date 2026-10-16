'use client'

import type { ReactNode } from 'react'
import { formatClockTime } from '@/lib/format'
import { useLastKnownAt } from '@/store/SystemProvider'

interface PanelProps {
  children: ReactNode
  labelledBy: string
  className?: string
}

export function Panel({ children, labelledBy, className = '' }: PanelProps) {
  // While the stream is cut, rows dim to 85 % (class panel-stale in globals.css, spec 15.4).
  const stale = useLastKnownAt() !== null
  return (
    <section
      aria-labelledby={labelledBy}
      className={`flex flex-col gap-4 rounded-panel border border-line bg-surface p-[18px] shadow-panel ${stale ? 'panel-stale' : ''} ${className}`}
    >
      {children}
    </section>
  )
}

interface PanelHeadingProps {
  id: string
  eyebrow: string
  title: string
  detail?: string
}

export function PanelHeading({ id, eyebrow, title, detail }: PanelHeadingProps) {
  const lastKnownAt = useLastKnownAt()
  return (
    <header className="flex items-end justify-between">
      <div className="flex flex-col gap-[5px]">
        <p className="font-mono text-[9px] font-semibold uppercase text-accent">{eyebrow}</p>
        <h2 id={id} className="font-display text-lg italic text-ink">
          {title}
        </h2>
      </div>
      {lastKnownAt !== null ? (
        <p className="font-mono text-[10px] uppercase text-warning">Last known · {formatClockTime(lastKnownAt)}</p>
      ) : detail ? (
        <p className="font-mono text-[10px] uppercase text-ink-muted">{detail}</p>
      ) : null}
    </header>
  )
}
