import { describe, expect, it } from 'vitest'
import { createBudgetGuard, estimateMaxCostUsd, startOfDay, startOfMonth } from './budget'

describe('calendar boundaries', () => {
  it('returns local midnight and the first day of the month', () => {
    const t = new Date(2026, 9, 6, 15, 30).getTime()
    expect(startOfDay(t)).toBe(new Date(2026, 9, 6).getTime())
    expect(startOfMonth(t)).toBe(new Date(2026, 9, 1).getTime())
  })
})

describe('estimateMaxCostUsd', () => {
  it('counts the full output ceiling, the schema and a conservative input estimate, per attempt', () => {
    const cost = estimateMaxCostUsd('claude-sonnet-5-5', {
      textChars: 2000,
      schemaChars: 500,
      images: 1,
      pdfPages: 2,
      maxOutputTokens: 4000,
      attempts: 2,
    })
    // input: 2000 + 500 + 1600 + 6000 = 10100 tokens -> 0.0202 USD ; output: 4000 tokens -> 0.04 USD ; two attempts
    expect(cost).toBeCloseTo(0.1204, 6)
  })
})

describe('createBudgetGuard', () => {
  it('lets only one of two simultaneous runs through when the budget fits one', async () => {
    const guard = createBudgetGuard()
    const spent = async () => 0.9
    const [a, b] = await Promise.all([guard.reserve(0.08, spent, 1), guard.reserve(0.08, spent, 1)])
    expect([a, b].filter((r) => r !== null)).toHaveLength(1)
  })
  it('frees the reservation once released', async () => {
    const guard = createBudgetGuard()
    const spent = async () => 0.9
    const first = await guard.reserve(0.08, spent, 1)
    first?.release()
    expect(await guard.reserve(0.08, spent, 1)).not.toBeNull()
  })
  it('keeps working after a failing spend lookup', async () => {
    const guard = createBudgetGuard()
    await expect(guard.reserve(0.01, async () => Promise.reject(new Error('db')), 1)).rejects.toThrow('db')
    expect(await guard.reserve(0.01, async () => 0, 1)).not.toBeNull()
  })
})
