import { ALLOWED_MODELS, type AllowedModel } from '../definitions/types'

export const PRICES_USD_PER_MTOK: Readonly<Record<AllowedModel, { input: number; output: number }>> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
}

/** Prompt cache: writes with the default 5-minute lifetime cost 1.25 times the input price; reads are flat. */
export const CACHE_PRICES_USD_PER_MTOK: Readonly<Record<AllowedModel, { write: number; read: number }>> = {
  'claude-opus-5-5': { write: 5, read: 0.2 },
  'claude-sonnet-5-5': { write: 2.5, read: 0.2 },
}

export function costUsd(model: AllowedModel, inputTokens: number, outputTokens: number): number {
  const price = PRICES_USD_PER_MTOK[model]
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}

export interface CachedUsage {
  /** Input tokens neither read from nor written to the cache. */
  inputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
  outputTokens: number
}

export function cachedCostUsd(model: AllowedModel, usage: CachedUsage): number {
  const cache = CACHE_PRICES_USD_PER_MTOK[model]
  return (
    costUsd(model, usage.inputTokens, usage.outputTokens) +
    (usage.cacheWriteTokens * cache.write + usage.cacheReadTokens * cache.read) / 1_000_000
  )
}

/** Maps the model name reported by the API to an allowed model, or null when it is outside the list. */
export function resolveAllowedModel(reported: string): AllowedModel | null {
  return ALLOWED_MODELS.find((m) => reported === m || reported.startsWith(`${m}-`)) ?? null
}
