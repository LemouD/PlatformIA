import type { AgentLimits } from '../definitions/types'

/** Hard ceilings. Neither the creator nor a fiche can go above them. */
export const CEILINGS = {
  maxRunsPerDay: 50,
  maxOutputTokens: 8000,
  nameMaxChars: 60,
  objectiveMaxChars: 200,
  labelMaxChars: 80,
  systemPromptMaxChars: 8000,
  inputFieldsMax: 12,
  fieldMaxLength: 20000,
  outputSchemaMaxChars: 8000,
  attachmentMaxBytes: 10 * 1024 * 1024,
  attachmentsPerRun: 3,
  pdfMaxPages: 20,
  commandMaxChars: 2000,
  creatorTextMaxChars: 4000,
  llmTimeoutMs: 120_000,
} as const

export const DEFAULT_LIMITS: AgentLimits = { maxRunsPerDay: 10, maxOutputTokens: 4000 }
