import { Pause } from 'lucide-react'
import { STATUS_META } from '@/design/status'
import type { AgentStatus } from '@/domain/types'

interface StatusBadgeProps {
  status: AgentStatus
}

const BADGE =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-surface-raised px-[9px] py-[5px] font-mono text-[9px] font-semibold uppercase'

export function StatusBadge({ status }: StatusBadgeProps) {
  const meta = STATUS_META[status]
  return (
    <span className={`${BADGE} ${meta.border} ${meta.text}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${meta.bg}`} />
      {meta.label}
    </span>
  )
}

/** Pause is an availability, not a seventh state: muted, with a pause icon (design spec 15.5). */
export function PausedBadge() {
  return (
    <span className={`${BADGE} border-ink-muted text-ink-muted`}>
      <Pause aria-hidden size={9} />
      Paused
    </span>
  )
}

/** The badge an agent shows: PAUSED while paused, its live state otherwise. */
export function AgentStateBadge({ status, paused }: { status: AgentStatus; paused: boolean }) {
  return paused ? <PausedBadge /> : <StatusBadge status={status} />
}
