import type { AgentDefinition } from './definitions/types'

export type ExecutionMode = 'test' | 'live'
export type ExecutionOrigin = 'form' | 'nova' | 'system'
/** `refused` = stopped by the checks, before any model call. */
export type ExecutionStatus = 'succeeded' | 'failed' | 'refused'

export type ErrorCode =
  | 'agent_not_found'
  | 'lifecycle_forbidden'
  | 'agent_paused'
  | 'daily_quota_reached'
  | 'monthly_budget_reached'
  | 'invalid_input'
  | 'attachment_rejected'
  | 'model_refused'
  | 'output_truncated'
  | 'output_invalid'
  | 'model_unavailable'
  | 'model_not_allowed'

export interface AttachmentMeta {
  fieldKey: string
  name: string
  mediaType: 'image/jpeg' | 'image/png' | 'application/pdf'
  sizeBytes: number
  sha256: string
  metadataStripped: boolean
}

export interface ExecutionRecord {
  id: string
  agentId: string
  agentVersion: number
  mode: ExecutionMode
  origin: ExecutionOrigin
  input: Record<string, string>
  attachments: AttachmentMeta[]
  output: unknown
  status: ExecutionStatus
  errorCode: ErrorCode | null
  inputTokens: number
  outputTokens: number
  costUsd: number
  model: string | null
  startedAt: number
  finishedAt: number
}

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export interface ExternalReport {
  id: string
  agentId: string
  receivedAt: number
  severity: Severity
  summary: string
  details: Record<string, string>
  /** True when invisible characters were removed from the report. */
  sanitized: boolean
}

export type AuditActor = 'user' | 'creator' | 'router' | 'gateway' | 'engine'

export interface AuditEntry {
  id: string
  at: number
  actor: AuditActor
  action: string
  agentId: string | null
  details: Record<string, string | number | boolean>
}

export interface AgentHistoryEntry {
  agentId: string
  version: number
  snapshot: AgentDefinition
  at: number
  reason: string
}
