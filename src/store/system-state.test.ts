import { describe, expect, it } from 'vitest'
import type { AgentEvent, AgentEventInput } from '@/domain/events'
import { mockAgents } from '@/mocks/agents'
import { applyEvent, createInitialState, LIMITS } from './system-state'
import type { SystemState } from './system-state'

const METRICS = { runningTasks: 0, apiUptime: 100, tokens: 0, costTodayUsd: 0 }

let counter = 0
function event(body: AgentEventInput & { at?: number }): AgentEvent {
  counter += 1
  return { id: `evt-${counter}`, at: counter * 1000, ...body }
}

function initial(): SystemState {
  return createInitialState(mockAgents, METRICS)
}

function statusOf(state: SystemState, agentId: string) {
  return state.agents.find((agent) => agent.id === agentId)?.status
}

describe('agent status', () => {
  it('applies an allowed transition and records it in the activity', () => {
    const state = applyEvent(initial(), event({ type: 'agent.status_changed', agentId: 'home', status: 'THINKING' }))
    expect(statusOf(state, 'home')).toBe('THINKING')
    expect(state.activity.at(-1)?.message).toBe('Home Agent is thinking')
  })

  it('refuses a forbidden transition and logs why', () => {
    const state = applyEvent(initial(), event({ type: 'agent.status_changed', agentId: 'home', status: 'COMPLETED' }))
    expect(statusOf(state, 'home')).toBe('IDLE')
    expect(state.logs.at(-1)).toMatchObject({ level: 'warn', component: 'interface.store' })
    expect(state.logs.at(-1)?.message).toContain('IDLE → COMPLETED')
  })

  it('refuses events about unknown agents', () => {
    const state = applyEvent(initial(), event({ type: 'agent.status_changed', agentId: 'ghost', status: 'WORKING' }))
    expect(state.agents).toEqual(initial().agents)
    expect(state.logs.at(-1)?.message).toContain('unknown agent')
  })

  it('cleans the activity line sent by the server', () => {
    const hidden = String.fromCodePoint(0x200b)
    const state = applyEvent(
      initial(),
      event({ type: 'agent.status_changed', agentId: 'home', status: 'WORKING', activity: `Dimming${hidden} lights` }),
    )
    expect(state.agents.find((agent) => agent.id === 'home')?.activity).toBe('Dimming lights')
  })
})

describe('duplicates and bookkeeping', () => {
  it('drops an event already applied', () => {
    const first = event({ type: 'agent.status_changed', agentId: 'home', status: 'THINKING' })
    const once = applyEvent(initial(), first)
    const twice = applyEvent(once, first)
    expect(twice).toBe(once)
  })

  it('keeps the latest event time', () => {
    const state = applyEvent(initial(), event({ type: 'metrics.updated', metrics: { tokens: 42 }, at: 5000 }))
    expect(state.lastEventAt).toBe(5000)
    expect(state.metrics.tokens).toBe(42)
  })

  it('caps the logs', () => {
    let state = initial()
    for (let index = 0; index < LIMITS.logs + 20; index += 1) {
      state = applyEvent(
        state,
        event({
          type: 'log.appended',
          log: { id: `log-${index}`, executionId: null, level: 'info', component: 'test', timestamp: index, message: 'x' },
        }),
      )
    }
    expect(state.logs).toHaveLength(LIMITS.logs)
    expect(state.logs.at(-1)?.id).toBe(`log-${LIMITS.logs + 19}`)
  })
})

describe('handoffs and approvals', () => {
  it('opens and closes a handoff', () => {
    const started = applyEvent(
      initial(),
      event({
        type: 'handoff.started',
        handoff: { id: 'h1', fromAgentId: 'nova', toAgentId: 'coding', label: 'Code change', startedAt: 0 },
      }),
    )
    expect(started.handoffs).toHaveLength(1)
    expect(started.activity.at(-1)?.message).toBe('NOVA handed the task to Coding Agent')
    const done = applyEvent(started, event({ type: 'handoff.completed', handoffId: 'h1' }))
    expect(done.handoffs).toHaveLength(0)
  })

  it('keeps a request pending until it is resolved, with its preview cleaned', () => {
    const marker = String.fromCodePoint(0x202e)
    const requested = applyEvent(
      initial(),
      event({
        type: 'approval.requested',
        approval: {
          id: 'a1',
          agentId: 'personal',
          executionId: null,
          summary: 'Send the menu',
          requestedAt: 0,
          preview: `Mon: soup${marker}`,
        },
      }),
    )
    expect(requested.approvals[0]?.preview).toBe('Mon: soup')
    const resolved = applyEvent(requested, event({ type: 'approval.resolved', approvalId: 'a1', decision: 'rejected' }))
    expect(resolved.approvals).toHaveLength(0)
    expect(resolved.activity.at(-1)).toMatchObject({ tone: 'danger', message: 'Request from Personal Agent rejected' })
  })
})

describe('tasks and executions', () => {
  it('tracks task progress within 0 to 100', () => {
    const created = applyEvent(
      initial(),
      event({
        type: 'task.created',
        task: {
          id: 't1',
          title: 'Weekly menu',
          status: 'running',
          agentId: 'personal',
          progress: 0,
          createdAt: 0,
          startedAt: 0,
          completedAt: null,
        },
      }),
    )
    const updated = applyEvent(created, event({ type: 'task.updated', taskId: 't1', progress: 140 }))
    expect(updated.tasks[0]?.progress).toBe(100)
  })

  it('reports failed executions in the activity', () => {
    const started = applyEvent(
      initial(),
      event({
        type: 'execution.started',
        execution: { id: 'x1', agentId: 'coding', taskId: null, mode: 'live', origin: 'form', startedAt: 0 },
      }),
    )
    const finished = applyEvent(
      started,
      event({
        type: 'execution.finished',
        executionId: 'x1',
        result: 'failed',
        errorCode: 'model_unavailable',
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
      }),
    )
    expect(finished.executions.x1?.result).toBe('failed')
    expect(finished.activity.at(-1)?.message).toBe('Coding Agent execution failed (model_unavailable)')
  })
})
