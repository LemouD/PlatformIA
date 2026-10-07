import { describe, expect, it } from 'vitest'
import { canTransition, TRANSITIONS } from './state-machine'
import { AGENT_STATUSES } from './types'

describe('state machine', () => {
  it('covers every status', () => {
    for (const status of AGENT_STATUSES) expect(TRANSITIONS[status]).toBeDefined()
  })

  it('follows a task from start to rest', () => {
    expect(canTransition('IDLE', 'THINKING')).toBe(true)
    expect(canTransition('THINKING', 'WORKING')).toBe(true)
    expect(canTransition('WORKING', 'COMPLETED')).toBe(true)
    expect(canTransition('COMPLETED', 'IDLE')).toBe(true)
  })

  it('lets a failed or finished agent start again', () => {
    expect(canTransition('ERROR', 'THINKING')).toBe(true)
    expect(canTransition('COMPLETED', 'THINKING')).toBe(true)
  })

  it('refuses shortcuts the table does not allow', () => {
    expect(canTransition('IDLE', 'COMPLETED')).toBe(false)
    expect(canTransition('IDLE', 'WAITING_APPROVAL')).toBe(false)
    expect(canTransition('WAITING_APPROVAL', 'COMPLETED')).toBe(false)
    expect(canTransition('ERROR', 'COMPLETED')).toBe(false)
  })

  it('treats a repeated status as a no-op, not an error', () => {
    for (const status of AGENT_STATUSES) expect(canTransition(status, status)).toBe(true)
  })
})
