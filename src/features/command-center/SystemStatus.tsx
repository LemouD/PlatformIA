import { Panel, PanelHeading } from '@/components/ui/Panel'
import type { SystemHealth } from '@/domain/types'
import type { MetricItem } from './system-metrics'

interface SystemStatusProps {
  health: SystemHealth
  metrics: readonly MetricItem[]
}

export function SystemStatus({ health, metrics }: SystemStatusProps) {
  return (
    <Panel labelledBy="system-status-title">
      <PanelHeading id="system-status-title" eyebrow="Health" title="System status" detail={health} />

      <dl className="flex gap-2">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex min-w-0 flex-1 flex-col gap-[5px] rounded-control bg-surface-sunken px-2 py-2.5"
          >
            <dt className="truncate font-mono text-[7px] uppercase text-ink-muted">{metric.label}</dt>
            <dd className="truncate text-[11px] text-ink">{metric.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}
