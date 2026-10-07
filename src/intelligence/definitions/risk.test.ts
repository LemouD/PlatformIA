import { describe, expect, it } from 'vitest'
import { computeRiskLevel } from './risk'

describe('computeRiskLevel', () => {
  it('is read_only without tools', () => {
    expect(computeRiskLevel([])).toBe('read_only')
  })
  it('treats an unknown tool as destructive', () => {
    expect(computeRiskLevel(['delete_everything'])).toBe('destructive')
  })
  it('does not trust inherited object keys', () => {
    expect(computeRiskLevel(['constructor'])).toBe('destructive')
  })
})
