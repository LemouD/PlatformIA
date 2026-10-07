import { describe, expect, it } from 'vitest'
import { canTransition } from '@/domain/state-machine'
import type { AgentStatus } from '@/domain/types'
import { mockAgents } from './agents'
import { commandScenario, decisionScenario, routeMockCommand } from './scenarios'

const IDS = { task: 't', execution: 'x', handoff: 'h' }

/** Replays the status changes of a scenario and checks each one against the state machine. */
function assertValidStatuses(steps: ReturnType<typeof commandScenario>, start: Record<string, AgentStatus>) {
  const status = { ...start }
  for (const { event } of steps) {
    if (event.type !== 'agent.status_changed') continue
    const from = status[event.agentId]
    expect(from, `unknown agent ${event.agentId}`).toBeDefined()
    if (from) expect(canTransition(from, event.status), `${from} → ${event.status}`).toBe(true)
    status[event.agentId] = event.status
  }
}

const idle = Object.fromEntries(mockAgents.map((agent) => [agent.id, 'IDLE' as AgentStatus]))

describe('routeMockCommand', () => {
  it('sends commands to the agent whose keywords match', () => {
    expect(routeMockCommand('Turn off the lights')).toBe('home')
    expect(routeMockCommand('Fix the bug in my repo')).toBe('coding')
    expect(routeMockCommand('Plan the weekly menu')).toBe('personal')
    expect(routeMockCommand('Research the latest Power Platform news')).toBe('research')
  })

  it('matches keywords at the start of words only', () => {
    expect(routeMockCommand('Show the latest figures')).toBeNull()
  })

  it('finds no agent for an unrelated command', () => {
    expect(routeMockCommand('Sing me a song')).toBeNull()
  })
})

describe('commandScenario', () => {
  it('routes through NOVA with a single handoff and valid transitions', () => {
    const steps = commandScenario('Turn off the lights', IDS)
    assertValidStatuses(steps, idle)
    const handoffs = steps.filter(({ event }) => event.type === 'handoff.started')
    expect(handoffs).toHaveLength(1)
    expect(steps.at(-1)?.event).toMatchObject({ type: 'agent.status_changed', agentId: 'home', status: 'COMPLETED' })
  })

  it('ends with NOVA saying no agent fits when nothing matches', () => {
    const steps = commandScenario('Sing me a song', IDS)
    assertValidStatuses(steps, idle)
    expect(steps.some(({ event }) => event.type === 'handoff.started')).toBe(false)
  })
})

describe('decisionScenario', () => {
  it('keeps valid transitions for both decisions', () => {
    assertValidStatuses(decisionScenario('personal', 'a', 'approved'), { ...idle, personal: 'WAITING_APPROVAL' })
    assertValidStatuses(decisionScenario('personal', 'a', 'rejected'), { ...idle, personal: 'WAITING_APPROVAL' })
  })
})
