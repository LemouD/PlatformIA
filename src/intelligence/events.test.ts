import { describe, expect, it } from 'vitest'
import { createEventFactory } from './events'
import { FakeClock, sequentialIds } from './testing/memory-ports'

const factory = () => createEventFactory(new FakeClock(1000), sequentialIds('ev'))

describe('createEventFactory', () => {
  it('stamps every event with an id and the clock time', () => {
    expect(factory().executionStarted('a1', 'x1', 'test', 'form')).toEqual({
      id: 'ev-1',
      at: 1000,
      type: 'execution.started',
      execution: { id: 'x1', agentId: 'a1', taskId: null, mode: 'test', origin: 'form', startedAt: 1000 },
    })
  })
  it('builds a timeline step', () => {
    expect(factory().executionStep('x1', 'LLM GENERATION', 'running', 'Request sent')).toMatchObject({
      type: 'execution.step',
      step: { executionId: 'x1', label: 'LLM GENERATION', status: 'running', timestamp: 1000 },
    })
  })
  it('omits the error code of a successful run', () => {
    const event = factory().executionFinished('x1', 'succeeded', { errorCode: null, tokensIn: 10, tokensOut: 5, costUsd: 0.01 })
    expect(event).toEqual({
      id: 'ev-1',
      at: 1000,
      type: 'execution.finished',
      executionId: 'x1',
      result: 'succeeded',
      tokensIn: 10,
      tokensOut: 5,
      costUsd: 0.01,
    })
  })
  it('builds a status change', () => {
    expect(factory().statusChanged('a1', 'THINKING', 'Calling the model', 'x1')).toMatchObject({
      type: 'agent.status_changed',
      agentId: 'a1',
      status: 'THINKING',
      executionId: 'x1',
    })
  })
  it('builds a log line', () => {
    expect(factory().log('error', 'engine.runner', 'run failed: output_invalid', 'x1')).toMatchObject({
      type: 'log.appended',
      log: { executionId: 'x1', level: 'error', component: 'engine.runner', message: 'run failed: output_invalid' },
    })
  })
  it('builds a partial metrics update in dollars', () => {
    expect(factory().metrics({ tokens: 120, costTodayUsd: 0.02 })).toMatchObject({
      type: 'metrics.updated',
      metrics: { tokens: 120, costTodayUsd: 0.02 },
    })
  })
  it('links handoff start and completion through the same id', () => {
    const f = factory()
    const { handoffId, event } = f.handoffStarted('nova', 'a1', 'Recettes demandées')
    expect(event).toMatchObject({ type: 'handoff.started', handoff: { id: handoffId, fromAgentId: 'nova', toAgentId: 'a1' } })
    expect(f.handoffCompleted(handoffId)).toMatchObject({ type: 'handoff.completed', handoffId })
  })
})
