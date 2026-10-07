import type { AgentDefinition, ConfiguredAgent, Lifecycle } from '../definitions/types'
import type {
  AgentStore,
  AuditLog,
  Clock,
  ExecutionStore,
  ExternalReportStore,
  LlmClient,
  LlmRequest,
  LlmResult,
  UsageTotals,
} from '../ports'
import type { AgentHistoryEntry, AuditEntry, ExecutionRecord, ExternalReport } from '../records'

export class MemoryAgentStore implements AgentStore {
  readonly agents = new Map<string, AgentDefinition>()
  history: AgentHistoryEntry[] = []

  async get(id: string): Promise<AgentDefinition | null> {
    return this.agents.get(id) ?? null
  }

  async listConfigured(): Promise<ConfiguredAgent[]> {
    return [...this.agents.values()].filter((a): a is ConfiguredAgent => a.family === 'configured')
  }

  async insert(agent: AgentDefinition): Promise<void> {
    if (this.agents.has(agent.id)) throw new Error(`duplicate agent ${agent.id}`)
    this.agents.set(agent.id, agent)
  }

  async compareAndSet(
    id: string,
    expected: { version: number; lifecycle: Lifecycle },
    next: AgentDefinition,
  ): Promise<boolean> {
    const current = this.agents.get(id)
    if (!current || current.version !== expected.version || current.lifecycle !== expected.lifecycle) return false
    this.agents.set(id, next)
    return true
  }

  async appendHistory(entry: AgentHistoryEntry): Promise<void> {
    this.history.push(entry)
  }

  async remove(id: string): Promise<void> {
    this.agents.delete(id)
    this.history = this.history.filter((h) => h.agentId !== id)
  }
}

export class MemoryExecutionStore implements ExecutionStore {
  records: ExecutionRecord[] = []

  async insert(record: ExecutionRecord): Promise<void> {
    this.records.push(record)
  }

  async countRunsSince(agentId: string, since: number): Promise<number> {
    return this.records.filter((r) => r.agentId === agentId && r.status !== 'refused' && r.startedAt >= since).length
  }

  async sumUsageSince(since: number): Promise<UsageTotals> {
    return this.records
      .filter((r) => r.startedAt >= since)
      .reduce<UsageTotals>(
        (acc, r) => ({ tokens: acc.tokens + r.inputTokens + r.outputTokens, costUsd: acc.costUsd + r.costUsd }),
        { tokens: 0, costUsd: 0 },
      )
  }

  async hasSucceededTest(agentId: string, version: number): Promise<boolean> {
    return this.records.some(
      (r) => r.agentId === agentId && r.agentVersion === version && r.mode === 'test' && r.status === 'succeeded',
    )
  }
}

export class MemoryReportStore implements ExternalReportStore {
  reports: ExternalReport[] = []
  async insert(report: ExternalReport): Promise<void> {
    this.reports.push(report)
  }
}

export class MemoryAuditLog implements AuditLog {
  entries: AuditEntry[] = []
  async append(entry: AuditEntry): Promise<void> {
    this.entries.push(entry)
  }
}

export class FakeClock implements Clock {
  constructor(private current: number = Date.UTC(2026, 9, 6, 10, 0, 0)) {}
  now(): number {
    return this.current
  }
  advance(ms: number): void {
    this.current += ms
  }
}

/** Returns queued results in order and records every request it receives. */
export class FakeLlmClient implements LlmClient {
  readonly requests: LlmRequest[] = []
  constructor(private readonly queue: LlmResult[] = []) {}

  push(...results: LlmResult[]): void {
    this.queue.push(...results)
  }

  async complete(request: LlmRequest): Promise<LlmResult> {
    this.requests.push(request)
    const next = this.queue.shift()
    if (!next) throw new Error('FakeLlmClient: no queued result')
    return next
  }
}

export function sequentialIds(prefix = 'id'): () => string {
  let n = 0
  return () => `${prefix}-${++n}`
}
