import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryEventSink } from '../events'
import { createBudgetGuard } from '../limits/budget'
import type { EngineDeps } from '../runner/run-agent'
import {
  FakeClock,
  FakeLlmClient,
  MemoryAgentStore,
  MemoryAuditLog,
  MemoryExecutionStore,
  sequentialIds,
} from '../testing/memory-ports'
import { callSystemModel, SYSTEM_AGENT_IDS } from './call-model'

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answer'],
  properties: { answer: { type: 'string' } },
}

let deps: EngineDeps
let llm: FakeLlmClient
let executions: MemoryExecutionStore

beforeEach(() => {
  llm = new FakeLlmClient()
  executions = new MemoryExecutionStore()
  deps = {
    agents: new MemoryAgentStore(),
    executions,
    audit: new MemoryAuditLog(),
    clock: new FakeClock(),
    newId: sequentialIds(),
    llm,
    events: new MemoryEventSink(),
    budget: createBudgetGuard(),
    settings: { monthlyBudgetUsd: 20, llmTimeoutMs: 60_000 },
  }
})

const call = () =>
  callSystemModel(deps, {
    agentId: SYSTEM_AGENT_IDS.creator,
    system: 'Tu réponds.',
    text: 'Question',
    outputSchema: SCHEMA,
    maxOutputTokens: 2000,
    effort: 'medium',
  })

describe('callSystemModel', () => {
  it('uses Opus 5.5, records the cost without the input, and returns the JSON', async () => {
    llm.push({ kind: 'ok', json: { answer: 'oui' }, model: 'claude-opus-5-5', usage: { inputTokens: 100, outputTokens: 50 } })
    expect(await call()).toEqual({ ok: true, json: { answer: 'oui' } })
    expect(llm.requests[0]?.model).toBe('claude-opus-5-5')
    expect(executions.records[0]).toMatchObject({ agentId: 'system:creator', origin: 'system', input: {}, output: null })
    expect(executions.records[0]?.costUsd).toBeCloseTo(0.0014, 6)
  })
  it('refuses when the budget is exhausted, without calling the model', async () => {
    deps.settings = { ...deps.settings, monthlyBudgetUsd: 0.001 }
    expect(await call()).toMatchObject({ ok: false, errorCode: 'monthly_budget_reached' })
    expect(llm.requests).toHaveLength(0)
  })
  it('retries once on a transient error', async () => {
    llm.push(
      { kind: 'error', cause: 'network', retryable: true },
      { kind: 'ok', json: { answer: 'oui' }, model: 'claude-opus-5-5', usage: { inputTokens: 1, outputTokens: 1 } },
    )
    expect(await call()).toMatchObject({ ok: true })
  })
  it('rejects output outside the schema and a model outside the list', async () => {
    llm.push({ kind: 'ok', json: { other: 1 }, model: 'claude-opus-5-5', usage: { inputTokens: 1, outputTokens: 1 } })
    expect(await call()).toMatchObject({ ok: false, errorCode: 'output_invalid' })
    llm.push({ kind: 'ok', json: { answer: 'x' }, model: 'claude-fable-5-1', usage: { inputTokens: 1, outputTokens: 1 } })
    expect(await call()).toMatchObject({ ok: false, errorCode: 'model_not_allowed' })
  })
})
