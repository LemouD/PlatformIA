import { describe, expect, it } from 'vitest'
import { mockAgents } from '@/mocks/agents'
import { buildSnapshot } from './snapshot'
import { createInitialState } from './system-state'

const DEFAULTS = { objective: 'Idle objective', suggestions: ['Try me'], syncedAt: 42 }
const METRICS = { runningTasks: 7, apiUptime: 99, tokens: 10, costTodayUsd: 1 }

describe('buildSnapshot', () => {
  it('falls back to the defaults before any event', () => {
    const snapshot = buildSnapshot(createInitialState(mockAgents, METRICS), DEFAULTS)
    expect(snapshot).toMatchObject({ objective: 'Idle objective', syncedAt: 42, handoffChain: [], approvals: [] })
    expect(snapshot.metrics.runningTasks).toBe(0)
  })

  it('shows the running task, the active handoff and the latest activity', () => {
    const base = createInitialState(mockAgents, METRICS)
    const state = {
      ...base,
      lastEventAt: 900,
      tasks: [
        { id: 't1', title: 'Old', status: 'completed' as const, agentId: 'home', progress: 100, createdAt: 0, startedAt: 0, completedAt: 1 },
        { id: 't2', title: 'Turn off the lights', status: 'running' as const, agentId: 'home', progress: 35, createdAt: 2, startedAt: 2, completedAt: null },
      ],
      handoffs: [{ id: 'h', fromAgentId: 'nova', toAgentId: 'home', label: 'x', startedAt: 0 }],
      activity: Array.from({ length: 8 }, (_, index) => ({ id: `a${index}`, timestamp: index, tone: 'info' as const, message: `m${index}` })),
    }
    const snapshot = buildSnapshot(state, DEFAULTS)
    expect(snapshot.objective).toBe('Turn off the lights')
    expect(snapshot.handoffChain).toEqual(['nova', 'home'])
    expect(snapshot.metrics.runningTasks).toBe(1)
    expect(snapshot.activity.map((entry) => entry.id)).toEqual(['a3', 'a4', 'a5', 'a6', 'a7'])
    expect(snapshot.syncedAt).toBe(900)
  })
})
