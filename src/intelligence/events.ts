import type { AgentEvent, ExecutionResult, LogLevel, StepStatus } from '@/domain/events'
import type { AgentStatus, SystemMetrics } from '@/domain/types'
import type { Clock } from './ports'
import type { ExecutionMode } from './records'

export interface EventSink {
  emit(event: AgentEvent): void
}

export class MemoryEventSink implements EventSink {
  readonly events: AgentEvent[] = []
  emit(event: AgentEvent): void {
    this.events.push(event)
  }
}

export interface FinishedTotals {
  errorCode: string | null
  tokensIn: number
  tokensOut: number
  costUsd: number
}

/** The only place where the engine builds domain events (contract: src/domain/events.ts). */
export interface EventFactory {
  executionStarted(agentId: string, executionId: string, mode: ExecutionMode, origin: 'form' | 'nova'): AgentEvent
  executionStep(executionId: string, label: string, status: StepStatus, message: string): AgentEvent
  executionFinished(executionId: string, result: ExecutionResult, totals: FinishedTotals): AgentEvent
  statusChanged(agentId: string, status: AgentStatus, activity: string, executionId?: string): AgentEvent
  log(level: LogLevel, component: string, message: string, executionId?: string): AgentEvent
  metrics(update: Pick<SystemMetrics, 'tokens' | 'costTodayUsd'>): AgentEvent
  handoffStarted(fromAgentId: string, toAgentId: string, label: string): { handoffId: string; event: AgentEvent }
  handoffCompleted(handoffId: string): AgentEvent
}

export function createEventFactory(clock: Clock, newId: () => string): EventFactory {
  const base = () => ({ id: newId(), at: clock.now() })
  return {
    executionStarted: (agentId, executionId, mode, origin) => {
      const meta = base()
      return {
        ...meta,
        type: 'execution.started',
        execution: { id: executionId, agentId, taskId: null, mode, origin, startedAt: meta.at },
      }
    },
    executionStep: (executionId, label, status, message) => {
      const meta = base()
      return {
        ...meta,
        type: 'execution.step',
        step: { id: newId(), executionId, label, status, timestamp: meta.at, message },
      }
    },
    executionFinished: (executionId, result, totals) => ({
      ...base(),
      type: 'execution.finished',
      executionId,
      result,
      ...(totals.errorCode ? { errorCode: totals.errorCode } : {}),
      tokensIn: totals.tokensIn,
      tokensOut: totals.tokensOut,
      costUsd: totals.costUsd,
    }),
    statusChanged: (agentId, status, activity, executionId) => ({
      ...base(),
      type: 'agent.status_changed',
      agentId,
      status,
      activity,
      ...(executionId ? { executionId } : {}),
    }),
    log: (level, component, message, executionId) => {
      const meta = base()
      return {
        ...meta,
        type: 'log.appended',
        log: { id: newId(), executionId: executionId ?? null, level, component, timestamp: meta.at, message },
      }
    },
    metrics: (update) => ({ ...base(), type: 'metrics.updated', metrics: update }),
    handoffStarted: (fromAgentId, toAgentId, label) => {
      const meta = base()
      const handoffId = newId()
      return {
        handoffId,
        event: { ...meta, type: 'handoff.started', handoff: { id: handoffId, fromAgentId, toAgentId, label, startedAt: meta.at } },
      }
    },
    handoffCompleted: (handoffId) => ({ ...base(), type: 'handoff.completed', handoffId }),
  }
}
