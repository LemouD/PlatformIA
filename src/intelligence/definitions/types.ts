import type { AgentAvailability, EnvironmentKind } from '@/domain/types'

export const ALLOWED_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5'] as const
export type AllowedModel = (typeof ALLOWED_MODELS)[number]

export const EFFORTS = ['low', 'medium', 'high'] as const
export type Effort = (typeof EFFORTS)[number]

export const LIFECYCLES = ['draft', 'test', 'active', 'disabled'] as const
export type Lifecycle = (typeof LIFECYCLES)[number]

export const ENVIRONMENTS = [
  'research',
  'coding',
  'home',
  'personal',
  'generic',
] as const satisfies readonly EnvironmentKind[]

export type RiskLevel = 'read_only' | 'write' | 'destructive'

export const INPUT_FIELD_TYPES = ['text', 'longtext', 'number', 'choice', 'attachment'] as const
export type InputFieldType = (typeof INPUT_FIELD_TYPES)[number]

export interface InputField {
  key: string
  label: string
  type: InputFieldType
  required: boolean
  maxLength?: number
  choices?: string[]
}

export type JsonSchema = Record<string, unknown>

export interface AgentLimits {
  maxRunsPerDay: number
  maxOutputTokens: number
}

/** What the creator proposes and Lemou validates. */
export interface ConfiguredAgentDraft {
  name: string
  objective: string
  environment: EnvironmentKind
  systemPrompt: string
  inputFields: InputField[]
  outputSchema: JsonSchema
  model: AllowedModel
  effort: Effort
  limits: AgentLimits
  tools: string[]
  testInput: Record<string, string>
}

export interface ConfiguredAgent extends ConfiguredAgentDraft {
  id: string
  family: 'configured'
  kind: 'on_demand'
  riskLevel: RiskLevel
  lifecycle: Lifecycle
  availability: AgentAvailability
  version: number
  createdAt: number
  updatedAt: number
}

export interface ExternalAgent {
  id: string
  family: 'external'
  name: string
  objective: string
  environment: EnvironmentKind
  lifecycle: 'active' | 'disabled'
  version: number
  /** SHA-256 hex of the token secret. The token itself is never stored. */
  tokenHash: string
  silenceAfterMinutes: number
  lastSeenAt: number | null
  createdAt: number
  updatedAt: number
}

export type AgentDefinition = ConfiguredAgent | ExternalAgent
