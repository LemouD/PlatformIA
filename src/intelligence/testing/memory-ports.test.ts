import { describe, expect, it } from 'vitest'
import { MemoryAgentStore, MemoryExecutionStore } from './memory-ports'
import { menuDraft } from './fixtures'
import type { ConfiguredAgent } from '../definitions/types'
import type { ExecutionRecord } from '../records'

function agent(): ConfiguredAgent {
  return {
    ...menuDraft(),
    id: 'a1',
    family: 'configured',
    kind: 'on_demand',
    riskLevel: 'read_only',
    lifecycle: 'draft',
    availability: 'online',
    version: 1,
    createdAt: 0,
    updatedAt: 0,
  }
}

function record(over: Partial<ExecutionRecord>): ExecutionRecord {
  return {
    id: 'e',
    agentId: 'a1',
    agentVersion: 1,
    mode: 'test',
    origin: 'form',
    input: {},
    attachments: [],
    output: null,
    status: 'succeeded',
    errorCode: null,
    inputTokens: 10,
    outputTokens: 20,
    costUsd: 0.5,
    model: 'claude-sonnet-5-5',
    startedAt: 100,
    finishedAt: 110,
    ...over,
  }
}

describe('MemoryAgentStore.compareAndSet', () => {
  it('writes only when version and lifecycle match', async () => {
    const store = new MemoryAgentStore()
    await store.insert(agent())
    expect(await store.compareAndSet('a1', { version: 2, lifecycle: 'draft' }, { ...agent(), version: 3 })).toBe(false)
    expect(await store.compareAndSet('a1', { version: 1, lifecycle: 'test' }, { ...agent(), version: 3 })).toBe(false)
    expect(await store.compareAndSet('a1', { version: 1, lifecycle: 'draft' }, { ...agent(), version: 2 })).toBe(true)
    expect((await store.get('a1'))?.version).toBe(2)
  })
})

describe('MemoryExecutionStore', () => {
  it('counts only executions that reached the model', async () => {
    const store = new MemoryExecutionStore()
    await store.insert(record({ id: 'e1' }))
    await store.insert(record({ id: 'e2', status: 'failed' }))
    await store.insert(record({ id: 'e3', status: 'refused' }))
    await store.insert(record({ id: 'e4', startedAt: 10 }))
    expect(await store.countRunsSince('a1', 50)).toBe(2)
  })
  it('sums usage since a date', async () => {
    const store = new MemoryExecutionStore()
    await store.insert(record({ id: 'e1' }))
    await store.insert(record({ id: 'e2', startedAt: 10 }))
    expect(await store.sumUsageSince(50)).toEqual({ tokens: 30, costUsd: 0.5 })
  })
  it('finds a succeeded test on a given version', async () => {
    const store = new MemoryExecutionStore()
    await store.insert(record({ id: 'e1', agentVersion: 1 }))
    expect(await store.hasSucceededTest('a1', 1)).toBe(true)
    expect(await store.hasSucceededTest('a1', 2)).toBe(false)
  })
})
