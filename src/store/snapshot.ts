import type { CommandCenterSnapshot } from '@/domain/types'
import type { SystemState } from './system-state'

/** Static parts of the Command Center that do not come from events. */
export interface SnapshotDefaults {
  objective: string
  suggestions: string[]
  syncedAt: number
}

const VISIBLE_ACTIVITY = 5

/** Turns the live system state into the props the Command Center already understands. */
export function buildSnapshot(state: SystemState, defaults: SnapshotDefaults): CommandCenterSnapshot {
  const runningTask = [...state.tasks].reverse().find((task) => task.status === 'running')
  const handoff = state.handoffs.at(-1)
  return {
    agents: state.agents,
    activity: state.activity.slice(-VISIBLE_ACTIVITY),
    metrics: { ...state.metrics, runningTasks: state.tasks.filter((task) => task.status === 'running').length },
    health: state.health,
    syncedAt: state.lastEventAt ?? defaults.syncedAt,
    objective: runningTask?.title ?? defaults.objective,
    handoffChain: handoff ? [handoff.fromAgentId, handoff.toAgentId] : [],
    suggestions: defaults.suggestions,
    approvals: state.approvals,
  }
}
