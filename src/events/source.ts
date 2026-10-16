import type { AgentEvent } from '@/domain/events'
import type { AgentAvailability } from '@/domain/types'

export type ApprovalDecision = 'approved' | 'rejected'

/** Whether live events are reaching the interface; when cut, when the next attempt is due. */
export type ConnectionState = { status: 'live' } | { status: 'interrupted'; retryAt: number | null }

/**
 * Where the interface gets its events and sends the user's actions. The mock source
 * plays scripted scenarios; the server source (chantier 2) will use the same contract.
 */
export interface AgentEventSource {
  subscribe(listener: (event: AgentEvent) => void): () => void
  /** Called on every change of the live connection. */
  subscribeConnection(listener: (connection: ConnectionState) => void): () => void
  /** Tries to reconnect now instead of waiting for the next attempt. */
  reconnect(): void
  /** Sent right away, or as soon as the connection is back. */
  submitCommand(command: string): void
  decide(approvalId: string, decision: ApprovalDecision): void
  setAvailability(agentId: string, availability: AgentAvailability): void
  dispose(): void
}
