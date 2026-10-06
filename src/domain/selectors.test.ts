import { describe, expect, it } from 'vitest'
import {
  countOnlineSpecialists,
  findOrchestrator,
  formatHandoffChain,
  listSpecialists,
} from './selectors'
import type { Agent } from './types'

function makeAgent(overrides: Partial<Agent> & Pick<Agent, 'id' | 'name'>): Agent {
  return {
    type: 'specialist',
    status: 'IDLE',
    availability: 'online',
    activity: '',
    model: 'test-model',
    description: '',
    tools: [],
    permissions: [],
    memoryId: null,
    currentTaskId: null,
    environment: 'generic',
    ...overrides,
  }
}

const nova = makeAgent({ id: 'nova', name: 'NOVA', type: 'orchestrator' })
const research = makeAgent({ id: 'research', name: 'Research Agent' })
const coding = makeAgent({ id: 'coding', name: 'Coding Agent', availability: 'paused' })
const agents = [research, nova, coding]

describe('findOrchestrator', () => {
  it('returns the orchestrator wherever it sits in the list', () => {
    expect(findOrchestrator(agents)).toBe(nova)
  })

  it('returns undefined when there is none', () => {
    expect(findOrchestrator([research])).toBeUndefined()
  })
})

describe('listSpecialists', () => {
  it('excludes the orchestrator and keeps order', () => {
    expect(listSpecialists(agents)).toEqual([research, coding])
  })
})

describe('countOnlineSpecialists', () => {
  it('ignores paused agents and the orchestrator', () => {
    expect(countOnlineSpecialists(agents)).toBe(1)
  })
})

describe('formatHandoffChain', () => {
  it('joins agent names with arrows', () => {
    expect(formatHandoffChain(['research', 'nova', 'coding'], agents)).toBe(
      'Research Agent → NOVA → Coding Agent',
    )
  })

  it('skips unknown agent ids', () => {
    expect(formatHandoffChain(['research', 'ghost', 'nova'], agents)).toBe('Research Agent → NOVA')
  })

  it('returns an empty string for an empty chain', () => {
    expect(formatHandoffChain([], agents)).toBe('')
  })
})
