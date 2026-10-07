import Link from 'next/link'
import type { CSSProperties } from 'react'
import { Panel, PanelHeading } from '@/components/ui/Panel'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { STATUS_META } from '@/design/status'
import { findOrchestrator, listSpecialists } from '@/domain/selectors'
import type { Agent } from '@/domain/types'
import { AgentRobot } from '@/features/agents/robot/AgentRobot'

interface AgentListProps {
  agents: readonly Agent[]
}

/** Phone replacement for the agent map: one 72 px row per agent, NOVA first. */
export function AgentList({ agents }: AgentListProps) {
  const orchestrator = findOrchestrator(agents)
  const ordered = orchestrator ? [orchestrator, ...listSpecialists(agents)] : listSpecialists(agents)

  return (
    <Panel labelledBy="agent-list-title">
      <PanelHeading id="agent-list-title" eyebrow={`${ordered.length} agents`} title="Your agents" />
      <ul className="flex flex-col gap-2">
        {ordered.map((agent) => {
          const meta = STATUS_META[agent.status]
          return (
            <li key={agent.id}>
              <Link
                href={`/agents/${agent.id}`}
                aria-label={`${agent.name}, ${meta.description}`}
                className="flex h-[72px] items-center gap-3 rounded-[14px] bg-surface-sunken px-3"
                style={{ '--agent-state': meta.color } as CSSProperties}
              >
                <span
                  aria-hidden
                  className="flex size-[52px] shrink-0 items-center justify-center rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, color-mix(in srgb, var(--agent-state) 28%, transparent), transparent 70%)',
                  }}
                >
                  <AgentRobot
                    status={agent.status}
                    environment={agent.environment}
                    role={agent.type}
                    variant="specimen"
                    facing="right"
                    moving={false}
                    size={50}
                  />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-display text-[17px] italic text-ink">{agent.name}</span>
                    <StatusBadge status={agent.status} />
                  </span>
                  <span className="truncate font-mono text-[11px] text-ink-muted">{agent.activity}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
