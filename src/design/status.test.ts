import { describe, expect, it } from 'vitest'
import { AGENT_STATUSES } from '@/domain/types'
import { STATUS_META } from './status'

describe('STATUS_META', () => {
  it('describes every status', () => {
    for (const status of AGENT_STATUSES) {
      expect(STATUS_META[status].label).not.toBe('')
      expect(STATUS_META[status].description).not.toBe('')
    }
  })

  it('gives each status its own colour', () => {
    const colors = AGENT_STATUSES.map((status) => STATUS_META[status].color)
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('uses the velvet gemstones', () => {
    expect(STATUS_META.IDLE.color).toBe('var(--color-brass-light)')
    expect(STATUS_META.THINKING.color).toBe('var(--color-info)')
    expect(STATUS_META.WORKING.color).toBe('var(--color-amethyst)')
    expect(STATUS_META.WAITING_APPROVAL.color).toBe('var(--color-warning)')
    expect(STATUS_META.ERROR.color).toBe('var(--color-danger)')
    expect(STATUS_META.COMPLETED.color).toBe('var(--color-success)')
  })
})
