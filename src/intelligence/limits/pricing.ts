import { ALLOWED_MODELS, type AllowedModel } from '../definitions/types'

export const PRICES_USD_PER_MTOK: Readonly<Record<AllowedModel, { input: number; output: number }>> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
}

export function costUsd(model: AllowedModel, inputTokens: number, outputTokens: number): number {
  const price = PRICES_USD_PER_MTOK[model]
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}

/** Maps the model name reported by the API to an allowed model, or null when it is outside the list. */
export function resolveAllowedModel(reported: string): AllowedModel | null {
  return ALLOWED_MODELS.find((m) => reported === m || reported.startsWith(`${m}-`)) ?? null
}
