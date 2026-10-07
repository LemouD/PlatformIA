'use client'

import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { STATUS_META } from '@/design/status'
import type { Agent } from '@/domain/types'
import { AgentRobot } from '@/features/agents/robot/AgentRobot'
import { AgentEnvironment } from './AgentEnvironment'
import type { Rect } from './orbit'
import { TERRITORY_HEIGHT, TERRITORY_WIDTH } from './orbit'
import { Spotlight } from './Spotlight'
import { facingFor, pickDestination, pickPause, travelDuration, WALK_ZONE } from './wander'

interface AgentWorldProps {
  agent: Agent
  rect: Rect
  scale: number
}

/** One agent's territory: floor, scene, spotlight, heading and its robot strolling while idle. */
export function AgentWorld({ agent, rect, scale }: AgentWorldProps) {
  const meta = STATUS_META[agent.status]
  const reduced = useReducedMotion() ?? false
  const x = useMotionValue(WALK_ZONE.cx)
  const y = useMotionValue(WALK_ZONE.cy)
  const [walking, setWalking] = useState(false)
  const [facing, setFacing] = useState<'left' | 'right'>('left')
  const wanders = agent.status === 'IDLE' && !reduced

  useEffect(() => {
    if (!wanders) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let running: { stop: () => void }[] = []

    const step = () => {
      if (cancelled) return
      const from = { x: x.get(), y: y.get() }
      const to = pickDestination(WALK_ZONE, from)
      const duration = travelDuration(from, to)
      setFacing(facingFor(from, to))
      setWalking(true)
      const moveX = animate(x, to.x, { duration, ease: 'easeInOut' })
      const moveY = animate(y, to.y, { duration, ease: 'easeInOut' })
      running = [moveX, moveY]
      void Promise.all([moveX, moveY]).then(() => {
        if (cancelled) return
        setWalking(false)
        timer = setTimeout(step, pickPause())
      })
    }

    timer = setTimeout(step, pickPause())
    return () => {
      cancelled = true
      clearTimeout(timer)
      running.forEach((animation) => animation.stop())
    }
  }, [wanders, x, y])

  return (
    <Link
      href={`/agents/${agent.id}`}
      aria-label={`${agent.name}, ${meta.description}`}
      className="absolute block rounded-card"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    >
      <div
        className="relative origin-top-left"
        style={
          {
            width: TERRITORY_WIDTH,
            height: TERRITORY_HEIGHT,
            transform: `scale(${scale})`,
            '--agent-state': meta.color,
          } as CSSProperties
        }
      >
        <AgentEnvironment
          environment={agent.environment}
          status={agent.status}
          showScene
          className="absolute left-[10px] top-[22px] h-[162.5px] w-[250px]"
        />

        <motion.div className="absolute left-0 top-0" style={{ x, y }}>
          <Spotlight
            opacity={agent.status === 'IDLE' ? 0 : 0.45}
            className="-left-[35px] -top-[130px] h-[130px] w-[70px]"
          />
          <div className="absolute -translate-x-1/2 -translate-y-full">
            <AgentRobot
              status={agent.status}
              environment={agent.environment}
              role="specialist"
              variant="world"
              facing={facing}
              moving={walking && wanders}
            />
          </div>
        </motion.div>

        <div className="absolute left-[18px] top-[8px] flex flex-col gap-[5px]">
          <span className="flex items-center gap-2">
            <span className="font-display text-[15px] italic text-ink">{agent.name}</span>
            <StatusBadge status={agent.status} />
          </span>
          <span className="font-mono text-[8px] text-ink-muted">{agent.activity}</span>
        </div>
      </div>
    </Link>
  )
}
