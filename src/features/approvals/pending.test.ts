import { describe, expect, it } from 'vitest'
import type { Approval } from '@/domain/events'
import { shouldDismissSheet, sortPendingApprovals } from './pending'

function approval(id: string, requestedAt: number): Approval {
  return { id, agentId: 'personal', executionId: null, summary: id, requestedAt }
}

describe('sortPendingApprovals', () => {
  it('puts the oldest request first', () => {
    const sorted = sortPendingApprovals([approval('b', 20), approval('a', 10), approval('c', 30)])
    expect(sorted.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps a stable order for requests made at the same time', () => {
    const sorted = sortPendingApprovals([approval('y', 5), approval('x', 5)])
    expect(sorted.map((item) => item.id)).toEqual(['x', 'y'])
  })

  it('does not modify the input', () => {
    const input = [approval('b', 2), approval('a', 1)]
    sortPendingApprovals(input)
    expect(input.map((item) => item.id)).toEqual(['b', 'a'])
  })
})

describe('shouldDismissSheet', () => {
  it('closes only after a real downward drag', () => {
    expect(shouldDismissSheet(20)).toBe(false)
    expect(shouldDismissSheet(80)).toBe(true)
    expect(shouldDismissSheet(-120)).toBe(false)
  })
})
