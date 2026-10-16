import type { AgentEvent } from '@/domain/events'
import { COMPLETED_HOLD_MS } from '@/domain/state-machine'
import type { ConnectionState } from '@/events/source'
import type { Scheduler } from './scheduler'
import { applyConnection, applyEvent } from './system-state'
import type { SystemState } from './system-state'

export interface SystemStore {
  getState(): SystemState
  dispatch(event: AgentEvent): void
  setConnection(connection: ConnectionState): void
  subscribe(listener: () => void): () => void
  dispose(): void
}

/**
 * Holds the system state and notifies subscribers. It also sends a finished agent
 * back to IDLE once the completion salute has played.
 */
export function createSystemStore(initial: SystemState, scheduler: Scheduler): SystemStore {
  let state = initial
  const listeners = new Set<() => void>()
  const timers = new Set<unknown>()

  function scheduleReturnToIdle(event: AgentEvent) {
    if (event.type !== 'agent.status_changed' || event.status !== 'COMPLETED') return
    const handle = scheduler.setTimeout(() => {
      timers.delete(handle)
      const agent = state.agents.find((candidate) => candidate.id === event.agentId)
      if (agent?.status !== 'COMPLETED') return
      dispatch({
        id: `auto-idle-${event.id}`,
        at: scheduler.now(),
        type: 'agent.status_changed',
        agentId: event.agentId,
        status: 'IDLE',
      })
    }, COMPLETED_HOLD_MS)
    timers.add(handle)
  }

  function dispatch(event: AgentEvent) {
    const next = applyEvent(state, event)
    if (next === state) return
    state = next
    scheduleReturnToIdle(event)
    listeners.forEach((listener) => listener())
  }

  function setConnection(connection: ConnectionState) {
    const next = applyConnection(state, connection, scheduler.now())
    if (next === state) return
    state = next
    listeners.forEach((listener) => listener())
  }

  return {
    getState: () => state,
    dispatch,
    setConnection,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      timers.forEach((handle) => scheduler.clearTimeout(handle))
      timers.clear()
      listeners.clear()
    },
  }
}
