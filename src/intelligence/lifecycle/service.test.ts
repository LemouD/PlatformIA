import { beforeEach, describe, expect, it } from 'vitest'
import {
  createConfiguredAgent,
  deleteAgent,
  setAvailability,
  transitionAgent,
  updateConfiguredAgent,
  type LifecycleDeps,
} from './service'
import { menuDraft } from '../testing/fixtures'
import {
  FakeClock,
  MemoryAgentStore,
  MemoryAuditLog,
  MemoryExecutionStore,
  sequentialIds,
} from '../testing/memory-ports'

let agents: MemoryAgentStore
let executions: MemoryExecutionStore
let audit: MemoryAuditLog
let deps: LifecycleDeps

beforeEach(() => {
  agents = new MemoryAgentStore()
  executions = new MemoryExecutionStore()
  audit = new MemoryAuditLog()
  deps = { agents, executions, audit, clock: new FakeClock(), newId: sequentialIds() }
})

async function created() {
  const result = await createConfiguredAgent(deps, menuDraft())
  if (!result.ok) throw new Error('setup failed')
  return result.value
}

async function succeededTest(agentId: string, version: number) {
  await executions.insert({
    id: `run-${version}`,
    agentId,
    agentVersion: version,
    mode: 'test',
    origin: 'form',
    input: {},
    attachments: [],
    output: {},
    status: 'succeeded',
    errorCode: null,
    inputTokens: 1,
    outputTokens: 1,
    costUsd: 0,
    model: 'claude-sonnet-5-5',
    startedAt: 0,
    finishedAt: 0,
  })
}

describe('createConfiguredAgent', () => {
  it('stores the validated fiche in draft, version 1, read_only, with history and audit', async () => {
    const agent = await created()
    expect(agent).toMatchObject({ lifecycle: 'draft', version: 1, riskLevel: 'read_only', availability: 'online' })
    expect(agents.history).toHaveLength(1)
    expect(audit.entries.map((e) => e.action)).toEqual(['agent_created'])
  })
  it('refuses an invalid fiche and stores nothing', async () => {
    const result = await createConfiguredAgent(deps, menuDraft({ tools: ['send_email'] }))
    expect(result).toMatchObject({ ok: false, error: 'invalid_draft' })
    expect(agents.agents.size).toBe(0)
  })
})

describe('transitionAgent', () => {
  it('refuses activation without a succeeded test on the current version', async () => {
    const agent = await created()
    await transitionAgent(deps, agent.id, 1, 'test')
    expect(await transitionAgent(deps, agent.id, 1, 'active')).toMatchObject({ ok: false, error: 'test_required' })
    await succeededTest(agent.id, 1)
    expect(await transitionAgent(deps, agent.id, 1, 'active')).toMatchObject({ ok: true })
  })
  it('refuses a stale expected version', async () => {
    const agent = await created()
    expect(await transitionAgent(deps, agent.id, 7, 'test')).toMatchObject({ ok: false, error: 'version_conflict' })
  })
  it('refuses a transition outside the table and audits it', async () => {
    const agent = await created()
    expect(await transitionAgent(deps, agent.id, 1, 'active')).toMatchObject({ ok: false, error: 'transition_forbidden' })
    expect(audit.entries.at(-1)?.action).toBe('transition_refused')
  })
})

describe('updateConfiguredAgent', () => {
  it('bumps the version and sends an active agent back to test', async () => {
    const agent = await created()
    await transitionAgent(deps, agent.id, 1, 'test')
    await succeededTest(agent.id, 1)
    await transitionAgent(deps, agent.id, 1, 'active')
    const result = await updateConfiguredAgent(deps, agent.id, 1, menuDraft({ name: 'Menus de la semaine' }), 'renommage')
    expect(result).toMatchObject({ ok: true, value: { version: 2, lifecycle: 'test', name: 'Menus de la semaine' } })
    expect(agents.history.map((h) => h.version)).toEqual([1, 2])
  })
  it('refuses an update based on a stale version', async () => {
    const agent = await created()
    await updateConfiguredAgent(deps, agent.id, 1, menuDraft({ name: 'A' }), 'a')
    expect(await updateConfiguredAgent(deps, agent.id, 1, menuDraft({ name: 'B' }), 'b')).toMatchObject({
      ok: false,
      error: 'version_conflict',
    })
  })
})

describe('setAvailability and deleteAgent', () => {
  it('pauses an agent', async () => {
    const agent = await created()
    expect(await setAvailability(deps, agent.id, 1, 'paused')).toMatchObject({ ok: true, value: { availability: 'paused' } })
  })
  it('deletes the agent and keeps the audit', async () => {
    const agent = await created()
    expect(await deleteAgent(deps, agent.id, 1)).toMatchObject({ ok: true })
    expect(agents.agents.size).toBe(0)
    expect(audit.entries.map((e) => e.action)).toEqual(['agent_created', 'agent_deleted'])
  })
})
