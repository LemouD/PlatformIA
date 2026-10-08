import { describe, expect, it } from 'vitest'
import type { Task } from '@/domain/events'
import { mockAgents } from '@/mocks/agents'
import { createInitialState } from '@/store/system-state'
import type { ExecutionRecord, SystemState } from '@/store/system-state'
import { agentLogs, agentStats, currentExecution, currentTask, formatLatency } from './agent-view'

const METRICS = { runningTasks: 0, apiUptime: 100, tokens: 0, costTodayUsd: 0 }

function record(id: string, agentId: string, startedAt: number, finishedAt: number | null, result: ExecutionRecord['result'], taskId: string | null = null): ExecutionRecord {
  return {
    execution: { id, agentId, taskId, mode: 'live', origin: 'nova', startedAt },
    steps: [],
    result,
    errorCode: null,
    finishedAt,
    tokens: 0,
    costUsd: 0,
  }
}

function task(id: string, status: Task['status']): Task {
  return { id, title: id, status, agentId: 'coding', progress: 0, createdAt: 0, startedAt: 0, completedAt: null }
}

function state(): SystemState {
  return {
    ...createInitialState(mockAgents, METRICS),
    tasks: [task('t1', 'completed'), task('t2', 'running'), task('t3', 'completed')],
    executions: {
      x1: record('x1', 'coding', 0, 2000, 'succeeded', 't1'),
      x2: record('x2', 'coding', 5000, 9000, 'failed', 't2'),
      x3: record('x3', 'coding', 10000, null, null),
      y1: record('y1', 'home', 0, 1000, 'succeeded'),
    },
    logs: [
      { id: 'l1', executionId: 'x1', level: 'info', component: 'a', timestamp: 1, message: 'one' },
      { id: 'l2', executionId: 'y1', level: 'info', component: 'a', timestamp: 2, message: 'home' },
      { id: 'l3', executionId: null, level: 'warn', component: 'a', timestamp: 3, message: 'system' },
      { id: 'l4', executionId: 'x2', level: 'error', component: 'a', timestamp: 4, message: 'two' },
    ],
  }
}

describe('agentStats', () => {
  it('counts runs and measures finished ones only', () => {
    expect(agentStats(state(), 'coding')).toEqual({ executions: 3, successRate: 50, averageLatencyMs: 3000 })
  })

  it('has no rate or latency before any finished run', () => {
    expect(agentStats(state(), 'personal')).toEqual({ executions: 0, successRate: null, averageLatencyMs: null })
  })
})

describe('current task and execution', () => {
  it('prefers the running task and its execution', () => {
    const current = currentTask(state(), 'coding')
    expect(current?.id).toBe('t2')
    expect(currentExecution(state(), 'coding', current)?.execution.id).toBe('x2')
  })

  it('falls back to the latest execution', () => {
    expect(currentExecution(state(), 'coding', null)?.execution.id).toBe('x3')
  })
})

describe('agentLogs', () => {
  it('keeps the lines of this agent only, newest last', () => {
    expect(agentLogs(state(), 'coding', 10).map((log) => log.id)).toEqual(['l1', 'l4'])
    expect(agentLogs(state(), 'coding', 1).map((log) => log.id)).toEqual(['l4'])
  })
})

describe('formatLatency', () => {
  it('switches to seconds from one second up', () => {
    expect(formatLatency(null)).toBe('—')
    expect(formatLatency(840)).toBe('840 ms')
    expect(formatLatency(4200)).toBe('4.2s')
  })
})
