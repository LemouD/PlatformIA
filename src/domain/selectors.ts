import type { Agent } from './types'

export function findOrchestrator(agents: readonly Agent[]): Agent | undefined {
  return agents.find((agent) => agent.type === 'orchestrator')
}

export function listSpecialists(agents: readonly Agent[]): Agent[] {
  return agents.filter((agent) => agent.type !== 'orchestrator')
}

export function countOnlineSpecialists(agents: readonly Agent[]): number {
  return listSpecialists(agents).filter((agent) => agent.availability === 'online').length
}

export function formatHandoffChain(agentIds: readonly string[], agents: readonly Agent[]): string {
  const namesById = new Map(agents.map((agent) => [agent.id, agent.name]))
  return agentIds
    .map((id) => namesById.get(id))
    .filter((name): name is string => name !== undefined)
    .join(' → ')
}
