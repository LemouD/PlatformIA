import { describe, expect, it } from 'vitest'
import { mockSnapshot } from '@/mocks/snapshot'
import { buildSystemMetrics } from './system-metrics'

describe('buildSystemMetrics', () => {
  it('builds the five tiles of the mockup', () => {
    expect(buildSystemMetrics(mockSnapshot)).toEqual([
      { label: 'Agents', value: '4 online' },
      { label: 'Tasks', value: '12 running' },
      { label: 'API', value: '99.9%' },
      { label: 'Tokens', value: '12.4K' },
      { label: 'Cost today', value: '€2.41' },
    ])
  })

  it('does not count paused agents as online', () => {
    const snapshot = {
      ...mockSnapshot,
      agents: mockSnapshot.agents.map((agent) =>
        agent.id === 'home' ? { ...agent, availability: 'paused' as const } : agent,
      ),
    }
    expect(buildSystemMetrics(snapshot)[0]).toEqual({ label: 'Agents', value: '3 online' })
  })
})
