import type { Log, Task } from '@/domain/events'
import type { ExecutionRecord, SystemState } from '@/store/system-state'

export interface AgentStats {
  executions: number
  /** Share of finished executions that succeeded, 0 to 100; null before any finished run. */
  successRate: number | null
  /** Mean duration of finished executions in ms; null before any finished run. */
  averageLatencyMs: number | null
}

function executionsOf(state: SystemState, agentId: string): ExecutionRecord[] {
  return Object.values(state.executions).filter((record) => record.execution.agentId === agentId)
}

export function agentStats(state: SystemState, agentId: string): AgentStats {
  const records = executionsOf(state, agentId)
  const finished = records.filter((record) => record.result !== null && record.finishedAt !== null)
  if (finished.length === 0) return { executions: records.length, successRate: null, averageLatencyMs: null }
  const succeeded = finished.filter((record) => record.result === 'succeeded').length
  const totalMs = finished.reduce((sum, record) => sum + ((record.finishedAt ?? 0) - record.execution.startedAt), 0)
  return {
    executions: records.length,
    successRate: Math.round((succeeded / finished.length) * 1000) / 10,
    averageLatencyMs: Math.round(totalMs / finished.length),
  }
}

/** The running task if there is one, otherwise the most recent one. */
export function currentTask(state: SystemState, agentId: string): Task | null {
  const tasks = state.tasks.filter((task) => task.agentId === agentId)
  return tasks.findLast((task) => task.status === 'running') ?? tasks.at(-1) ?? null
}

/** The execution of the current task, or the latest execution of the agent. */
export function currentExecution(state: SystemState, agentId: string, task: Task | null): ExecutionRecord | null {
  const records = executionsOf(state, agentId)
  if (task) {
    const forTask = records.findLast((record) => record.execution.taskId === task.id)
    if (forTask) return forTask
  }
  return records.reduce<ExecutionRecord | null>(
    (latest, record) => (!latest || record.execution.startedAt >= latest.execution.startedAt ? record : latest),
    null,
  )
}

export function agentLogs(state: SystemState, agentId: string, limit: number): Log[] {
  const ids = new Set(executionsOf(state, agentId).map((record) => record.execution.id))
  return state.logs.filter((log) => log.executionId !== null && ids.has(log.executionId)).slice(-limit)
}

export function formatLatency(ms: number | null): string {
  if (ms === null) return '—'
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)}s`
}
