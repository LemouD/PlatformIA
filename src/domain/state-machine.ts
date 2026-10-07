import type { AgentStatus } from './types'

/** Allowed status changes. Anything absent from this table is refused. */
export const TRANSITIONS: Readonly<Record<AgentStatus, readonly AgentStatus[]>> = {
  IDLE: ['THINKING', 'WORKING', 'ERROR'],
  THINKING: ['WORKING', 'WAITING_APPROVAL', 'COMPLETED', 'ERROR'],
  WORKING: ['THINKING', 'WAITING_APPROVAL', 'COMPLETED', 'ERROR'],
  WAITING_APPROVAL: ['WORKING', 'IDLE', 'ERROR'],
  ERROR: ['IDLE', 'THINKING', 'WORKING'],
  COMPLETED: ['IDLE', 'THINKING', 'WORKING'],
}

export function canTransition(from: AgentStatus, to: AgentStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to)
}

/** Time the completion salute needs before the agent goes back to IDLE (agents design spec 5.4). */
export const COMPLETED_HOLD_MS = 1500
