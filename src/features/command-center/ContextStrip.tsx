import { GitBranch } from 'lucide-react'

const CARD = 'flex min-w-0 flex-1 items-center gap-3 rounded-card border border-line bg-surface p-4'
const LABEL = 'font-mono text-[8px] uppercase text-ink-muted'
const VALUE = 'truncate text-[11px] text-ink-soft'

interface ContextStripProps {
  objective: string
  handoff: string
}

export function ContextStrip({ objective, handoff }: ContextStripProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <div className={CARD}>
        <span aria-hidden className="size-[9px] shrink-0 rounded-full bg-info shadow-glow" />
        <div className="flex min-w-0 flex-col gap-[3px]">
          <p className={LABEL}>Current objective</p>
          <p className={VALUE}>{objective}</p>
        </div>
      </div>

      <div className={CARD}>
        <GitBranch aria-hidden size={16} className="shrink-0 text-accent" />
        <div className="flex min-w-0 flex-col gap-[3px]">
          <p className={LABEL}>Active handoff</p>
          <p className={VALUE}>{handoff === '' ? 'No active handoff' : handoff}</p>
        </div>
      </div>
    </div>
  )
}
