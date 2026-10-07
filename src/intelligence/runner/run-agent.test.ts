import { beforeEach, describe, expect, it } from 'vitest'
import type { AgentEvent } from '@/domain/events'
import { MemoryEventSink } from '../events'
import { createConfiguredAgent, setAvailability, transitionAgent } from '../lifecycle/service'
import { createBudgetGuard } from '../limits/budget'
import type { LlmResult } from '../ports'
import { menuDraft } from '../testing/fixtures'
import {
  FakeClock,
  FakeLlmClient,
  MemoryAgentStore,
  MemoryAuditLog,
  MemoryExecutionStore,
  sequentialIds,
} from '../testing/memory-ports'
import { runAgent, type EngineDeps, type RunRequest } from './run-agent'

const OK = {
  kind: 'ok',
  json: { recipes: [{ name: 'Riz au poulet', steps: ['Cuire'] }], shoppingList: [] },
  model: 'claude-sonnet-5-5',
  usage: { inputTokens: 1000, outputTokens: 500 },
} satisfies LlmResult
const FORM = { ingredients: 'riz, poulet', people: '4' }

let deps: EngineDeps
let llm: FakeLlmClient
let executions: MemoryExecutionStore
let events: MemoryEventSink
let agentId: string

const types = () => events.events.map((e: AgentEvent) => e.type)
const statuses = () => events.events.flatMap((e) => (e.type === 'agent.status_changed' ? [e.status] : []))

beforeEach(async () => {
  llm = new FakeLlmClient()
  executions = new MemoryExecutionStore()
  events = new MemoryEventSink()
  deps = {
    agents: new MemoryAgentStore(),
    executions,
    audit: new MemoryAuditLog(),
    clock: new FakeClock(),
    newId: sequentialIds(),
    llm,
    events,
    budget: createBudgetGuard(),
    settings: { monthlyBudgetUsd: 20, llmTimeoutMs: 60_000 },
  }
  const created = await createConfiguredAgent(deps, menuDraft())
  if (!created.ok) throw new Error('setup')
  agentId = created.value.id
  await transitionAgent(deps, agentId, 1, 'test')
})

const run = (over: Partial<RunRequest> = {}) =>
  runAgent(deps, { agentId, mode: 'test', origin: 'form', fields: FORM, attachments: [], ...over })

describe('runAgent — success', () => {
  it('calls the model with the fiche and records the execution', async () => {
    llm.push(OK)
    const result = await run()
    expect(result).toMatchObject({ ok: true, output: OK.json })
    expect(llm.requests[0]).toMatchObject({ model: 'claude-sonnet-5-5', system: menuDraft().systemPrompt, maxOutputTokens: 4000 })
    expect(executions.records[0]).toMatchObject({ status: 'succeeded', mode: 'test', inputTokens: 1000, outputTokens: 500 })
    expect(executions.records[0]?.costUsd).toBeCloseTo(0.007, 6)
  })
  it('emits the events in order and never IDLE', async () => {
    llm.push(OK)
    await run()
    expect(types()).toEqual([
      'execution.started',
      'agent.status_changed',
      'execution.step',
      'execution.step',
      'execution.step',
      'execution.finished',
      'agent.status_changed',
      'metrics.updated',
    ])
    expect(statuses()).toEqual(['THINKING', 'COMPLETED'])
  })
})

describe('runAgent — refusals before any call', () => {
  it('refuses a live run on an agent in test and only logs', async () => {
    const result = await run({ mode: 'live' })
    expect(result).toMatchObject({ ok: false, errorCode: 'lifecycle_forbidden' })
    expect(llm.requests).toHaveLength(0)
    expect(types()).toEqual(['log.appended'])
    expect(executions.records[0]).toMatchObject({ status: 'refused', costUsd: 0 })
  })
  it('refuses a paused agent', async () => {
    await setAvailability(deps, agentId, 1, 'paused')
    expect(await run()).toMatchObject({ ok: false, errorCode: 'agent_paused' })
  })
  it('refuses invalid input with details', async () => {
    expect(await run({ fields: { people: '4' } })).toMatchObject({
      ok: false,
      errorCode: 'invalid_input',
      details: ['ingredients: champ obligatoire'],
    })
  })
  it('refuses once the daily quota is reached', async () => {
    for (let i = 0; i < 10; i++) llm.push(OK)
    for (let i = 0; i < 10; i++) await run()
    expect(await run()).toMatchObject({ ok: false, errorCode: 'daily_quota_reached' })
  })
  it('refuses when the monthly budget cannot absorb the maximum cost', async () => {
    deps.settings = { ...deps.settings, monthlyBudgetUsd: 0.01 }
    expect(await run()).toMatchObject({ ok: false, errorCode: 'monthly_budget_reached' })
  })
  it('lets only one of two simultaneous runs through a budget that fits one', async () => {
    deps.settings = { ...deps.settings, monthlyBudgetUsd: 0.06 }
    llm.push(OK, OK)
    const results = await Promise.all([run(), run()])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.filter((r) => !r.ok && r.errorCode === 'monthly_budget_reached')).toHaveLength(1)
  })
  it('refuses an unknown agent', async () => {
    expect(await run({ agentId: 'nope' })).toMatchObject({ ok: false, errorCode: 'agent_not_found', executionId: null })
  })
})

describe('runAgent — model outcomes', () => {
  it('retries once on a retryable error', async () => {
    llm.push({ kind: 'error', cause: 'overloaded', retryable: true }, OK)
    expect(await run()).toMatchObject({ ok: true })
    expect(llm.requests).toHaveLength(2)
  })
  it('does not retry a non-retryable error and reports its cause only', async () => {
    llm.push({ kind: 'error', cause: 'auth', retryable: false })
    expect(await run()).toMatchObject({ ok: false, errorCode: 'model_unavailable', details: ['auth'] })
    expect(llm.requests).toHaveLength(1)
  })
  it.each([
    [{ kind: 'refused', model: 'claude-sonnet-5-5', usage: { inputTokens: 10, outputTokens: 0 } }, 'model_refused'],
    [{ kind: 'truncated', model: 'claude-sonnet-5-5', usage: { inputTokens: 10, outputTokens: 4000 } }, 'output_truncated'],
    [{ kind: 'invalid_json', model: 'claude-sonnet-5-5', usage: { inputTokens: 10, outputTokens: 10 } }, 'output_invalid'],
    [{ ...OK, json: { recipes: 'pas un tableau' } }, 'output_invalid'],
    [{ ...OK, model: 'claude-opus-4-8' }, 'model_not_allowed'],
  ] satisfies [LlmResult, string][])('maps %o to %s, sets ERROR and logs', async (outcome, code) => {
    llm.push(outcome)
    expect(await run()).toMatchObject({ ok: false, errorCode: code })
    expect(statuses()).toEqual(['THINKING', 'ERROR'])
    expect(types()).toContain('log.appended')
    expect(executions.records[0]).toMatchObject({ status: 'failed', errorCode: code })
  })
  it('never puts form values in events', async () => {
    llm.push(OK)
    await run({ fields: { ingredients: 'secret-de-famille', people: '4' } })
    expect(JSON.stringify(events.events)).not.toContain('secret-de-famille')
  })
})
