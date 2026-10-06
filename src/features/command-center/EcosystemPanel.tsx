import { Panel, PanelHeading } from '@/components/ui/Panel'
import { listSpecialists } from '@/domain/selectors'
import type { Agent } from '@/domain/types'
import { formatClockTime } from '@/lib/format'

interface EcosystemPanelProps {
  agents: readonly Agent[]
  syncedAt: number
}

export function EcosystemPanel({ agents, syncedAt }: EcosystemPanelProps) {
  const activeCount = listSpecialists(agents).length

  return (
    <Panel labelledBy="ecosystem-title">
      <PanelHeading
        id="ecosystem-title"
        eyebrow={`Live ecosystem · ${activeCount} active entities`}
        title="Your agents are collaborating"
        detail={`Sync ${formatClockTime(syncedAt)}`}
      />
      <div className="relative min-h-[560px]" />
    </Panel>
  )
}
