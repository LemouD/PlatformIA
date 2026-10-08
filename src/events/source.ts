import type { AgentEvent } from '@/domain/events'
import type { AgentAvailability } from '@/domain/types'

export type ApprovalDecision = 'approved' | 'rejected'

/**
 * Where the interface gets its events and sends the user's actions. The mock source
 * plays scripted scenarios; the server source (chantier 2) will use the same contract.
 */
export interface AgentEventSource {
  subscribe(listener: (event: AgentEvent) => void): () => void
  submitCommand(command: string): void
  decide(approvalId: string, decision: ApprovalDecision): void
  setAvailability(agentId: string, availability: AgentAvailability): void
  dispose(): void
}
