import { describe, expect, it } from 'vitest'
import { mockAgents } from '@/mocks/agents'
import { mockSnapshot } from '@/mocks/snapshot'
import { createManualScheduler } from '@/store/scheduler'
import { createInitialState } from '@/store/system-state'
import { createSystemStore } from '@/store/system-store'
import { createMockEventSource } from './mock-source'

function setup() {
  const scheduler = createManualScheduler(1_000)
  const agents = mockAgents.map((agent) => ({
    ...agent,
    status: agent.id === 'personal' ? ('WAITING_APPROVAL' as const) : ('IDLE' as const),
  }))
  const store = createSystemStore(createInitialState(agents, mockSnapshot.metrics), scheduler)
  const source = createMockEventSource(scheduler, { pendingApprovals: mockSnapshot.approvals })
  source.subscribe(store.dispatch)
  const status = (id: string) => store.getState().agents.find((agent) => agent.id === id)?.status
  return { scheduler, store, source, status }
}

describe('mock event source', () => {
  it('replays pending approvals when the interface connects', () => {
    const { store } = setup()
    expect(store.getState().approvals.map((approval) => approval.id)).toEqual(['approval-1'])
  })

  it('runs a command from NOVA to the chosen agent and back to rest', () => {
    const { store, scheduler, source, status } = setup()
    source.submitCommand('Turn off the lights')
    scheduler.advance(100)
    expect(status('nova')).toBe('THINKING')
    scheduler.advance(1_500)
    expect(store.getState().handoffs).toHaveLength(1)
    scheduler.advance(10_000)
    expect(store.getState().handoffs).toHaveLength(0)
    expect(store.getState().tasks[0]).toMatchObject({ status: 'completed', progress: 100 })
    expect(status('home')).toBe('IDLE')
    expect(status('nova')).toBe('IDLE')
    expect(store.getState().logs.filter((log) => log.component === 'interface.store')).toEqual([])
  })

  it('resolves an approval and lets the agent finish', () => {
    const { store, scheduler, source, status } = setup()
    source.decide('approval-1', 'approved')
    scheduler.advance(400)
    expect(store.getState().approvals).toHaveLength(0)
    expect(status('personal')).toBe('WORKING')
    scheduler.advance(5_000)
    expect(status('personal')).toBe('IDLE')
  })

  it('pauses and resumes an agent', () => {
    const { store, scheduler, source } = setup()
    const availability = () => store.getState().agents.find((agent) => agent.id === 'coding')?.availability
    source.setAvailability('coding', 'paused')
    scheduler.advance(300)
    expect(availability()).toBe('paused')
    source.setAvailability('coding', 'online')
    scheduler.advance(300)
    expect(availability()).toBe('online')
  })

  it('records when, how long and how much each execution cost', () => {
    const { store, scheduler, source } = setup()
    source.submitCommand('Fix the bug in the repo')
    scheduler.advance(15_000)
    const [record] = Object.values(store.getState().executions)
    expect(record).toMatchObject({ result: 'succeeded', tokens: 2450, costUsd: 0.02 })
    expect(record?.finishedAt).toBeGreaterThan(record?.execution.startedAt ?? Infinity)
  })

  it('ignores decisions on unknown requests', () => {
    const { scheduler, source } = setup()
    source.decide('nope', 'approved')
    expect(scheduler.pending()).toBe(0)
  })

  it('stops everything when disposed', () => {
    const { scheduler, source } = setup()
    source.submitCommand('Turn off the lights')
    source.dispose()
    expect(scheduler.pending()).toBe(0)
  })
})
