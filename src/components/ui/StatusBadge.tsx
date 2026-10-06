import { STATUS_META } from '@/design/status'
import type { AgentStatus } from '@/domain/types'

interface StatusBadgeProps {
  status: AgentStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const meta = STATUS_META[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-surface-raised px-[9px] py-[5px] font-mono text-[9px] font-semibold uppercase ${meta.border} ${meta.text}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${meta.bg}`} />
      {meta.label}
    </span>
  )
}
