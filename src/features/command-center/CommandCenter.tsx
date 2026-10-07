import { formatHandoffChain } from '@/domain/selectors'
import type { CommandCenterSnapshot } from '@/domain/types'
import { AgentList } from './AgentList'
import { AgentStates } from './AgentStates'
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

/**
 * One tree for both layouts. Below 768 px the wrappers become `display: contents`
 * and `order` puts the command field first, then agents, handoff, activity and status.
 */
export function CommandCenter({ snapshot }: CommandCenterProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pt-4 pb-6 md:gap-[22px] md:px-9 md:pt-[30px] md:pb-[34px]">
      <div className="max-md:hidden">
        <PageHeading />
      </div>

      <div className="grid items-start gap-[18px] max-md:contents xl:grid-cols-[minmax(0,880fr)_minmax(0,450fr)]">
        <div className="max-md:hidden">
          <EcosystemPanel agents={snapshot.agents} syncedAt={snapshot.syncedAt} />
        </div>
        <div className="max-md:order-2 md:hidden">
          <AgentList agents={snapshot.agents} />
        </div>
        <div className="flex flex-col gap-3.5 max-md:contents">
          <div className="max-md:order-4">
            <LiveActivity entries={snapshot.activity} />
          </div>
          <div className="max-md:order-5">
            <SystemStatus health={snapshot.health} metrics={buildSystemMetrics(snapshot)} />
          </div>
          <div className="max-md:hidden">
            <AgentStates />
          </div>
        </div>
      </div>

      <div className="max-md:order-3">
        <ContextStrip
          objective={snapshot.objective}
          handoff={formatHandoffChain(snapshot.handoffChain, snapshot.agents)}
        />
      </div>

      <div className="max-md:order-1">
        <CommandInput suggestions={snapshot.suggestions} />
      </div>
    </div>
  )
}
