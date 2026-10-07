import { describe, expect, it } from 'vitest'
import { MemoryEventSink } from './events'
import {
  createAnthropicLlmClient,
  createBudgetGuard,
  createConfiguredAgent,
  proposeAgent,
  routeCommand,
  runAgent,
  transitionAgent,
  type RouterDeps,
} from './index'
import { MemoryAgentStore, MemoryAuditLog, MemoryExecutionStore, sequentialIds } from './testing/memory-ports'

const enabled = process.env.AI_OS_LIVE_TEST === '1' && Boolean(process.env.ANTHROPIC_API_KEY)

describe.skipIf(!enabled)('live: menu generator end to end', () => {
  it('is described, proposed, tested, activated, run and routed', { timeout: 300_000 }, async () => {
    const deps: RouterDeps = {
      agents: new MemoryAgentStore(),
      executions: new MemoryExecutionStore(),
      audit: new MemoryAuditLog(),
      clock: { now: () => Date.now() },
      newId: sequentialIds('live'),
      llm: createAnthropicLlmClient({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' }),
      events: new MemoryEventSink(),
      budget: createBudgetGuard(),
      settings: { monthlyBudgetUsd: 1, llmTimeoutMs: 120_000 },
      novaAgentId: 'nova',
    }

    const description =
      "Je veux un agent qui me propose trois recettes familiales à partir des ingrédients que j'ai, pour un nombre de personnes donné, avec la liste de courses de ce qui manque."
    let proposal = await proposeAgent(deps, { description, rounds: [] })
    if (proposal.ok && proposal.kind === 'questions') {
      proposal = await proposeAgent(deps, {
        description,
        rounds: [{ questions: proposal.questions, answers: proposal.questions.map(() => 'Fais au plus simple.') }],
      })
    }
    expect(proposal).toMatchObject({ ok: true, kind: 'proposal' })
    if (!proposal.ok || proposal.kind !== 'proposal') return

    const created = await createConfiguredAgent(deps, proposal.draft)
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const agent = created.value
    await transitionAgent(deps, agent.id, 1, 'test')

    const test = await runAgent(deps, { agentId: agent.id, mode: 'test', origin: 'form', fields: agent.testInput, attachments: [] })
    expect(test).toMatchObject({ ok: true })
    expect(await transitionAgent(deps, agent.id, 1, 'active')).toMatchObject({ ok: true })

    const live = await runAgent(deps, { agentId: agent.id, mode: 'live', origin: 'form', fields: agent.testInput, attachments: [] })
    expect(live).toMatchObject({ ok: true })

    const routed = await routeCommand(deps, 'Propose-moi des recettes pour 4 personnes avec du riz et du poulet')
    expect(routed).toMatchObject({ ok: true, kind: 'agent', agentId: agent.id })
  })
})
