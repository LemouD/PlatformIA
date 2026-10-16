import { describe, expect, it } from 'vitest'
import { cachedCostUsd, costUsd, resolveAllowedModel } from './pricing'

describe('costUsd', () => {
  it('prices Opus 5.5 at 4 / 20 USD per million tokens', () => {
    expect(costUsd('claude-opus-5-5', 1_000_000, 1_000_000)).toBe(24)
  })
  it('prices Sonnet 5.5 at 2 / 10 USD per million tokens', () => {
    expect(costUsd('claude-sonnet-5-5', 2000, 1000)).toBeCloseTo(0.014, 6)
  })
})

describe('cachedCostUsd', () => {
  it('prices Sonnet 5.5 cache writes at 2.50 and cache reads at 0.20 USD per million tokens', () => {
    const usage = { inputTokens: 1_000_000, cacheWriteTokens: 1_000_000, cacheReadTokens: 1_000_000, outputTokens: 1_000_000 }
    expect(cachedCostUsd('claude-sonnet-5-5', usage)).toBeCloseTo(2 + 2.5 + 0.2 + 10, 6)
  })
})

describe('resolveAllowedModel', () => {
  it('accepts the exact ids', () => {
    expect(resolveAllowedModel('claude-opus-5-5')).toBe('claude-opus-5-5')
    expect(resolveAllowedModel('claude-sonnet-5-5')).toBe('claude-sonnet-5-5')
  })
  it('rejects any other model', () => {
    expect(resolveAllowedModel('claude-opus-4-8')).toBeNull()
    expect(resolveAllowedModel('claude-haiku-4-5')).toBeNull()
    expect(resolveAllowedModel('claude-opus-5')).toBeNull()
  })
})
