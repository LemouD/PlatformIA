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

      <dl className="grid grid-cols-2 gap-2 md:flex">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex min-w-0 flex-1 flex-col gap-[5px] rounded-control bg-surface-sunken px-2 py-2.5 last:max-md:col-span-2"
          >
            <dt className="truncate font-mono text-[10px] uppercase text-ink-muted md:text-[7px]">{metric.label}</dt>
            <dd className="truncate text-base text-ink md:text-[11px]">{metric.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}
