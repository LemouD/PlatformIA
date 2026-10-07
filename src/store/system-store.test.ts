import { describe, expect, it, vi } from 'vitest'
import { COMPLETED_HOLD_MS } from '@/domain/state-machine'
import { mockAgents } from '@/mocks/agents'
import { createManualScheduler } from './scheduler'
import { createInitialState } from './system-state'
import { createSystemStore } from './system-store'

const METRICS = { runningTasks: 0, apiUptime: 100, tokens: 0, costTodayUsd: 0 }

function setup() {
  const scheduler = createManualScheduler()
  const store = createSystemStore(createInitialState(mockAgents, METRICS), scheduler)
  const status = (id: string) => store.getState().agents.find((agent) => agent.id === id)?.status
  return { scheduler, store, status }
}

describe('system store', () => {
  it('notifies subscribers when an event changes the state', () => {
    const { store } = setup()
    const listener = vi.fn()
    store.subscribe(listener)
    store.dispatch({ id: 'e1', at: 0, type: 'agent.status_changed', agentId: 'home', status: 'THINKING' })
    expect(listener).toHaveBeenCalledTimes(1)
    store.dispatch({ id: 'e1', at: 0, type: 'agent.status_changed', agentId: 'home', status: 'THINKING' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('sends a finished agent back to IDLE after the salute', () => {
    const { store, scheduler, status } = setup()
    store.dispatch({ id: 'e1', at: 0, type: 'agent.status_changed', agentId: 'coding', status: 'COMPLETED' })
    scheduler.advance(COMPLETED_HOLD_MS - 1)
    expect(status('coding')).toBe('COMPLETED')
    scheduler.advance(1)
    expect(status('coding')).toBe('IDLE')
  })

  it('does not interrupt an agent that started new work during the salute', () => {
    const { store, scheduler, status } = setup()
    store.dispatch({ id: 'e1', at: 0, type: 'agent.status_changed', agentId: 'coding', status: 'COMPLETED' })
    store.dispatch({ id: 'e2', at: 10, type: 'agent.status_changed', agentId: 'coding', status: 'THINKING' })
    scheduler.advance(COMPLETED_HOLD_MS)
    expect(status('coding')).toBe('THINKING')
  })

  it('cancels pending timers when disposed', () => {
    const { store, scheduler } = setup()
    store.dispatch({ id: 'e1', at: 0, type: 'agent.status_changed', agentId: 'coding', status: 'COMPLETED' })
    expect(scheduler.pending()).toBe(1)
    store.dispose()
    expect(scheduler.pending()).toBe(0)
  })
})
