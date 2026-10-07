'use client'

import { findOrchestrator, listSpecialists } from '@/domain/selectors'
import type { Agent } from '@/domain/types'
import { AgentWorld } from './AgentWorld'
import { NovaCore } from './NovaCore'
import { BASE_MAP_HEIGHT, computeOrbitLayout, MAP_WIDTH } from './orbit'
import { useElementWidth } from './useElementWidth'

interface EcosystemMapProps {
  agents: readonly Agent[]
}

/**
 * The map keeps the mockup's 840 × 560 window. The canvas inside is scaled to the
 * available width and scrolls within the window when more than eight agents need extra rows.
 */
export function EcosystemMap({ agents }: EcosystemMapProps) {
  const [ref, viewportWidth] = useElementWidth<HTMLDivElement>()
  const orchestrator = findOrchestrator(agents)
  const specialists = listSpecialists(agents)
  const layout = computeOrbitLayout(specialists.length)
  const k = viewportWidth === null ? null : viewportWidth / layout.width
  const scrollable = layout.height > BASE_MAP_HEIGHT

  return (
    <div
      className="relative w-full overflow-hidden rounded-card"
      style={{ aspectRatio: `${MAP_WIDTH} / ${BASE_MAP_HEIGHT}` }}
    >
      <div
        ref={ref}
        tabIndex={scrollable ? 0 : undefined}
        aria-label={scrollable ? 'Agent map, scrollable' : undefined}
        className="absolute inset-0 overflow-x-hidden overflow-y-auto"
      >
        <div className="relative w-full" style={{ height: k === null ? '100%' : layout.height * k }}>
          <div aria-hidden className="velvet-folds absolute inset-0" />
          {k === null ? null : (
            <ul
              className="absolute left-0 top-0 origin-top-left"
              style={{ width: layout.width, height: layout.height, transform: `scale(${k})` }}
            >
              {orchestrator ? (
                <li>
                  <NovaCore agent={orchestrator} rect={layout.center} />
                </li>
              ) : null}
              {specialists.map((agent, index) => {
                const rect = layout.territories[index]
                return rect ? (
                  <li key={agent.id}>
                    <AgentWorld agent={agent} rect={rect} scale={layout.scale} />
                  </li>
                ) : null
              })}
            </ul>
          )}
        </div>
      </div>
      <div aria-hidden className="velvet-vignette pointer-events-none absolute inset-0" />
    </div>
  )
}
