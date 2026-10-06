import { describe, expect, it } from 'vitest'
import { AGENT_EVENT_TYPES, EVENT_TYPES_COMPLETE } from './events'
import type { AgentEvent } from './events'

describe('AGENT_EVENT_TYPES', () => {
  it('lists every event type once', () => {
    expect(new Set(AGENT_EVENT_TYPES).size).toBe(AGENT_EVENT_TYPES.length)
    expect(EVENT_TYPES_COMPLETE).toBe(true)
  })

  it('accepts a well-formed event', () => {
    const event: AgentEvent = {
      id: 'evt-1',
      at: 0,
      type: 'handoff.started',
      handoff: { id: 'h-1', fromAgentId: 'nova', toAgentId: 'coding', label: 'Code change', startedAt: 0 },
    }
    expect(AGENT_EVENT_TYPES).toContain(event.type)
  })
})
