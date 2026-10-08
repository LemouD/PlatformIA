import { beforeEach, describe, expect, it } from 'vitest'
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
import { completeHandoff, routeCommand, type RouterDeps } from './route-command'

const reply = (json: unknown): LlmResult => ({
  kind: 'ok',
  json,
  model: 'claude-opus-5-5',
  usage: { inputTokens: 10, outputTokens: 10 },
})

let deps: RouterDeps
let llm: FakeLlmClient
let events: MemoryEventSink
let executions: MemoryExecutionStore
let menuId: string

const types = () => events.events.map((e) => e.type)
const novaStatuses = () =>
  events.events.flatMap((e) => (e.type === 'agent.status_changed' && e.agentId === 'nova' ? [e.status] : []))

async function activeMenuAgent(): Promise<string> {
  const created = await createConfiguredAgent(deps, menuDraft())
  if (!created.ok) throw new Error('setup')
  const id = created.value.id
  await transitionAgent(deps, id, 1, 'test')
  await executions.insert({
    id: 'seed',
    agentId: id,
    agentVersion: 1,
    mode: 'test',
    origin: 'form',
    input: {},
    attachments: [],
    output: {},
    status: 'succeeded',
    errorCode: null,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    model: 'claude-sonnet-5-5',
    startedAt: 0,
    finishedAt: 0,
  })
  await transitionAgent(deps, id, 1, 'active')
  return id
}

beforeEach(async () => {
  llm = new FakeLlmClient()
  events = new MemoryEventSink()
  executions = new MemoryExecutionStore()
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
    novaAgentId: 'nova',
  }
  menuId = await activeMenuAgent()
})

describe('routeCommand', () => {
  it('routes to the chosen agent with a sanitised prefill and starts a handoff', async () => {
    llm.push(reply({ agentId: menuId, reason: 'Recettes demandées', prefill: [{ key: 'people', value: '4' }, { key: 'x', value: 'y' }] }))
    const result = await routeCommand(deps, 'Des recettes pour 4 avec du riz')
    expect(result).toMatchObject({ ok: true, kind: 'agent', agentId: menuId, reason: 'Recettes demandées', prefill: { people: '4' } })
    expect(novaStatuses()).toEqual(['THINKING', 'COMPLETED'])
    expect(types()).toContain('handoff.started')
    if (result.ok && result.kind === 'agent') {
      completeHandoff(deps, result.handoffId)
      expect(types().at(-1)).toBe('handoff.completed')
    }
  })
  it('treats an invented agent id as no agent, without handoff', async () => {
    llm.push(reply({ agentId: 'agent-imaginaire', reason: 'ok', prefill: [] }))
    expect(await routeCommand(deps, 'Fais quelque chose')).toMatchObject({ ok: true, kind: 'no_agent' })
    expect(novaStatuses()).toEqual(['THINKING', 'COMPLETED'])
    expect(types()).not.toContain('handoff.started')
  })
  it('excludes paused agents from the candidates', async () => {
    await setAvailability(deps, menuId, 1, 'paused')
    expect(await routeCommand(deps, 'Des recettes')).toMatchObject({ ok: true, kind: 'no_agent' })
    expect(llm.requests).toHaveLength(0)
  })
  it('sets NOVA in ERROR and logs when the call fails', async () => {
    llm.push({ kind: 'error', cause: 'auth', retryable: false })
    expect(await routeCommand(deps, 'Des recettes')).toMatchObject({ ok: false, errorCode: 'model_unavailable' })
    expect(novaStatuses()).toEqual(['THINKING', 'ERROR'])
    expect(types()).toContain('log.appended')
  })
  it('refuses an overlong command with a log only', async () => {
    expect(await routeCommand(deps, 'x'.repeat(2001))).toMatchObject({ ok: false, errorCode: 'invalid_input' })
    expect(types()).toEqual(['log.appended'])
  })
  it('removes invisible characters from the command before sending and reports it', async () => {
    llm.push(reply({ agentId: null, reason: 'Aucun agent', prefill: [] }))
    const tag = String.fromCodePoint(0xe0041)
    expect(await routeCommand(deps, `Des recettes${tag}`)).toMatchObject({ ok: true, inputSanitized: true })
    const sent = llm.requests[0]?.content[0]
    expect(sent?.type === 'text' && sent.text).not.toContain(tag)
  })
  it('never puts the command in events', async () => {
    llm.push(reply({ agentId: null, reason: 'Aucun agent', prefill: [] }))
    await routeCommand(deps, 'commande-confidentielle')
    expect(JSON.stringify(events.events)).not.toContain('commande-confidentielle')
  })
})
