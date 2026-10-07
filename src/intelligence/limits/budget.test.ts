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
  it('counts the full output ceiling and a conservative input estimate', () => {
    const cost = estimateMaxCostUsd('claude-sonnet-5-5', { textChars: 2000, images: 1, pdfPages: 2, maxOutputTokens: 4000 })
    // input: 1000 + 1600 + 6000 = 8600 tokens -> 0.0172 USD ; output: 4000 tokens -> 0.04 USD
    expect(cost).toBeCloseTo(0.0572, 6)
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
