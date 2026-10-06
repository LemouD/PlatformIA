import { describe, expect, it } from 'vitest'
import { mockSnapshot } from './snapshot'

describe('mockSnapshot', () => {
  it('has exactly one orchestrator', () => {
    const orchestrators = mockSnapshot.agents.filter((agent) => agent.type === 'orchestrator')
    expect(orchestrators).toHaveLength(1)
  })

  it('uses unique agent ids', () => {
    const ids = mockSnapshot.agents.map((agent) => agent.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only references known agents in the handoff chain', () => {
    const ids = new Set(mockSnapshot.agents.map((agent) => agent.id))
    expect(mockSnapshot.handoffChain.every((id) => ids.has(id))).toBe(true)
  })

  it('lists activity in chronological order', () => {
    const timestamps = mockSnapshot.activity.map((entry) => entry.timestamp)
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b))
  })
})
