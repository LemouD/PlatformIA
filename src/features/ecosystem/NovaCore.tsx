import Link from 'next/link'
import type { CSSProperties } from 'react'
import { STATUS_META } from '@/design/status'
import type { Agent } from '@/domain/types'
import { AgentRobot } from '@/features/agents/robot/AgentRobot'
import { AgentEnvironment } from './AgentEnvironment'
import type { Rect } from './orbit'
import { CENTER_HEIGHT, CENTER_WIDTH } from './orbit'
import { Spotlight } from './Spotlight'

interface NovaCoreProps {
  agent: Agent
  rect: Rect
}

/** NOVA at the centre of the map: larger floor, permanent spotlight, conductor's baton. */
export function NovaCore({ agent, rect }: NovaCoreProps) {
  const meta = STATUS_META[agent.status]
  const scale = rect.width / CENTER_WIDTH

  return (
    <Link
      href={`/agents/${agent.id}`}
      aria-label={`${agent.name}, orchestrator, ${meta.description}`}
      className="absolute block rounded-card"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    >
      <div
        className="relative origin-top-left"
        style={
          {
            width: CENTER_WIDTH,
            height: CENTER_HEIGHT,
            transform: `scale(${scale})`,
            '--agent-state': meta.color,
          } as CSSProperties
        }
      >
        <AgentEnvironment
          environment="generic"
          status={agent.status}
          showScene={false}
          className="absolute -left-[46px] top-[20px] h-[203px] w-[312px]"
        />
        <Spotlight opacity={0.25} className="left-[70px] top-[18px] h-[150px] w-[80px]" />
        <div className="absolute left-[110px] top-[160px] -translate-x-1/2 -translate-y-full">
          <AgentRobot
            status={agent.status}
            environment={agent.environment}
            role="orchestrator"
            variant="world"
            facing="right"
            moving={false}
          />
        </div>
        <div className="absolute inset-x-0 top-[168px] flex flex-col items-center gap-1">
          <span className="font-display text-[22px] leading-none italic text-ink">{agent.name}</span>
          <span className="font-mono text-[8px] uppercase text-ink-muted">Personal AI orchestrator</span>
        </div>
      </div>
    </Link>
  )
}
