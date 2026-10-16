'use client'

import { Bot } from 'lucide-react'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { agentHref } from '@/config/navigation'
import { AgentStateBadge } from '@/components/ui/StatusBadge'
import { STATUS_META } from '@/design/status'
import type { Agent } from '@/domain/types'
import { AgentRobot } from '@/features/agents/robot/AgentRobot'
import { useNow } from '@/lib/useNow'
import { useSystemState } from '@/store/SystemProvider'
import type { SystemState } from '@/store/system-state'
import type { AgentFilter } from './agent-view'
import { AGENT_FILTERS, agentStats, currentTask, matchesAgentFilter, pausedLabel, sortAgents } from './agent-view'

function AgentCard({ agent, state, now }: { agent: Agent; state: SystemState; now: number | null }) {
  const paused = agent.availability === 'paused'
  const task = currentTask(state, agent.id)
  const running = task?.status === 'running' ? task : null
  const stats = agentStats(state, agent.id)
  const meta = STATUS_META[agent.status]

  return (
    <li>
      <Link
        href={agentHref(agent.id)}
        aria-label={`${agent.name}, ${paused ? 'paused' : meta.description}`}
        className="flex h-full flex-col gap-4 rounded-panel border border-line bg-surface p-[18px] shadow-panel transition-colors hover:border-accent focus-visible:border-accent"
        style={{ '--agent-state': meta.color } as CSSProperties}
      >
        <div className="flex items-start gap-4">
          <span aria-hidden className="shrink-0">
            <AgentRobot
              status={agent.status}
              environment={agent.environment}
              role={agent.type}
              variant="specimen"
              facing="right"
              moving={false}
              progress={running ? running.progress / 100 : undefined}
              paused={paused}
              size={84}
            />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-xl italic text-ink">{agent.name}</h2>
              <AgentStateBadge status={agent.status} paused={paused} />
            </div>
            <p className="font-mono text-[10px] uppercase text-info">
              {agent.type} · {agent.model}
            </p>
            {paused ? (
              <p className="font-mono text-[11px] text-ink-muted">{pausedLabel(now === null ? null : agent.pausedAt, now ?? 0)}</p>
            ) : (
              <p className="line-clamp-2 text-sm text-ink-soft">{agent.activity}</p>
            )}
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
          {running ? (
            <>
              <p className="truncate text-sm text-ink">{running.title}</p>
              <span aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${running.progress}%` }} />
              </span>
            </>
          ) : (
            <p className="text-sm text-ink-muted">No task running</p>
          )}
          <p className="font-mono text-[10px] uppercase text-ink-muted">
            {stats.executions} {stats.executions === 1 ? 'run' : 'runs'}
            {stats.successRate === null ? '' : ` · ${stats.successRate}% success`}
          </p>
        </div>
      </Link>
    </li>
  )
}

/** Every agent at a glance; any number of them, each card opens its detail page. */
export function AgentsView() {
  const state = useSystemState()
  const now = useNow(60_000)
  const [filter, setFilter] = useState<AgentFilter>('all')

  const agents = sortAgents(state.agents)
  const visible = agents.filter((agent) => matchesAgentFilter(agent, filter))
  const busy = agents.filter((agent) => matchesAgentFilter(agent, 'busy')).length
  const paused = agents.filter((agent) => matchesAgentFilter(agent, 'paused')).length

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 pt-4 pb-6 md:px-9 md:pt-[30px]">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase text-info">
          {agents.length} agents · {busy} busy · {paused} paused
        </p>
        <h1 className="font-display text-[28px] leading-none italic text-ink md:text-[40px]">Agents</h1>
      </header>

      {agents.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-panel border border-line bg-surface px-6 py-14 text-center">
          <Bot aria-hidden size={32} className="text-accent" />
          <h2 className="font-display text-2xl italic text-ink">No agents yet</h2>
          <p className="max-w-md text-sm text-ink-soft">
            Agents appear here as soon as they are registered. Each one gets its own robot and territory on the map.
          </p>
        </section>
      ) : (
        <>
          <div role="radiogroup" aria-label="Filter agents" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {AGENT_FILTERS.map((option) => {
              const selected = filter === option.value
              const count = agents.filter((agent) => matchesAgentFilter(agent, option.value)).length
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setFilter(option.value)}
                  className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm md:h-9 ${
                    selected ? 'border-accent bg-surface-raised text-ink' : 'border-line-control text-ink-soft'
                  }`}
                >
                  {option.label}
                  <span className="font-mono text-[11px] tabular-nums text-ink-muted">{count}</span>
                </button>
              )
            })}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-panel border border-line bg-surface px-6 py-10 text-center text-sm text-ink-soft">
              No agent matches this filter.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((agent) => (
                <AgentCard key={agent.id} agent={agent} state={state} now={now} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
