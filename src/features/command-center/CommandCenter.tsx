import { formatHandoffChain } from '@/domain/selectors'
import type { CommandCenterSnapshot } from '@/domain/types'
import { CommandInput } from './CommandInput'
import { ContextStrip } from './ContextStrip'
import { EcosystemPanel } from './EcosystemPanel'
import { LiveActivity } from './LiveActivity'
import { PageHeading } from './PageHeading'
import { SystemStatus } from './SystemStatus'
import { buildSystemMetrics } from './system-metrics'

interface CommandCenterProps {
  snapshot: CommandCenterSnapshot
}

export function CommandCenter({ snapshot }: CommandCenterProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[22px] px-9 pt-[30px] pb-[34px]">
      <PageHeading />

      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,880fr)_minmax(0,450fr)]">
        <EcosystemPanel agents={snapshot.agents} syncedAt={snapshot.syncedAt} />
        <div className="flex flex-col gap-3.5">
          <LiveActivity entries={snapshot.activity} />
          <SystemStatus health={snapshot.health} metrics={buildSystemMetrics(snapshot)} />
        </div>
      </div>

      <ContextStrip
        objective={snapshot.objective}
        handoff={formatHandoffChain(snapshot.handoffChain, snapshot.agents)}
      />

      <CommandInput suggestions={snapshot.suggestions} />
    </div>
  )
}
