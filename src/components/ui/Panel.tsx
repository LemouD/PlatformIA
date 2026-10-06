import type { ReactNode } from 'react'

interface PanelProps {
  children: ReactNode
  labelledBy: string
  className?: string
}

export function Panel({ children, labelledBy, className = '' }: PanelProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={`flex flex-col gap-4 rounded-panel border border-line bg-surface p-[18px] shadow-panel ${className}`}
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
  return (
    <header className="flex items-end justify-between">
      <div className="flex flex-col gap-[5px]">
        <p className="font-mono text-[9px] font-semibold uppercase text-accent">{eyebrow}</p>
        <h2 id={id} className="font-display text-lg italic text-ink">
          {title}
        </h2>
      </div>
      {detail ? <p className="font-mono text-[10px] uppercase text-ink-muted">{detail}</p> : null}
    </header>
  )
}
