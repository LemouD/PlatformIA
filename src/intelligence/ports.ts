import type { AgentDefinition, AllowedModel, ConfiguredAgent, Effort, JsonSchema, Lifecycle } from './definitions/types'
import type { AgentHistoryEntry, AuditEntry, ExecutionRecord, ExternalReport } from './records'

export interface AgentStore {
  get(id: string): Promise<AgentDefinition | null>
  listConfigured(): Promise<ConfiguredAgent[]>
  insert(agent: AgentDefinition): Promise<void>
  /** Writes `next` only if the stored agent still has this version and lifecycle. Returns false otherwise. */
  compareAndSet(id: string, expected: { version: number; lifecycle: Lifecycle }, next: AgentDefinition): Promise<boolean>
  appendHistory(entry: AgentHistoryEntry): Promise<void>
  /** Deletes the agent, its history and its executions. Audit entries are kept. */
  remove(id: string): Promise<void>
}

export interface UsageTotals {
  tokens: number
  costUsd: number
}

export interface ExecutionStore {
  insert(record: ExecutionRecord): Promise<void>
  /** Executions that reached the model (status succeeded or failed) for this agent since `since`. */
  countRunsSince(agentId: string, since: number): Promise<number>
  /** Tokens and cost of every execution since `since`, all agents included. */
  sumUsageSince(since: number): Promise<UsageTotals>
  hasSucceededTest(agentId: string, version: number): Promise<boolean>
}

export interface ExternalReportStore {
  insert(report: ExternalReport): Promise<void>
}

export interface AuditLog {
  append(entry: AuditEntry): Promise<void>
}

export interface Clock {
  now(): number
}

export type LlmContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: 'image/jpeg' | 'image/png'; base64: string }
  | { type: 'pdf'; base64: string }

export interface LlmRequest {
  model: AllowedModel
  effort: Effort
  system: string
  content: LlmContentBlock[]
  outputSchema: JsonSchema
  maxOutputTokens: number
  timeoutMs: number
}

export type LlmErrorCause = 'network' | 'timeout' | 'overloaded' | 'rate_limited' | 'auth' | 'bad_request' | 'unknown'

export interface LlmUsage {
  inputTokens: number
  outputTokens: number
}

export type LlmResult =
  | { kind: 'ok'; json: unknown; model: string; usage: LlmUsage }
  | { kind: 'refused'; model: string; usage: LlmUsage }
  | { kind: 'truncated'; model: string; usage: LlmUsage }
  | { kind: 'invalid_json'; model: string; usage: LlmUsage }
  | { kind: 'error'; cause: LlmErrorCause; retryable: boolean }

export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResult>
}
