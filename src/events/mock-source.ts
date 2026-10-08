import type { AgentEvent, AgentEventInput, Approval } from '@/domain/events'
import { commandScenario, decisionScenario } from '@/mocks/scenarios'
import type { ScenarioStep } from '@/mocks/scenarios'
import type { Scheduler } from '@/store/scheduler'
import type { AgentEventSource, ApprovalDecision } from './source'

/** Scenarios are written without times; the source dates each payload when it emits it. */
export function stampTimes(event: AgentEventInput, at: number): AgentEventInput {
  switch (event.type) {
    case 'task.created':
      return { ...event, task: { ...event.task, createdAt: at, startedAt: at } }
    case 'task.updated':
      return event
    case 'execution.started':
      return { ...event, execution: { ...event.execution, startedAt: at } }
    case 'execution.step':
      return { ...event, step: { ...event.step, timestamp: at } }
    case 'log.appended':
      return { ...event, log: { ...event.log, timestamp: at } }
    case 'handoff.started':
      return { ...event, handoff: { ...event.handoff, startedAt: at } }
    case 'approval.requested':
      return { ...event, approval: { ...event.approval, requestedAt: at } }
    default:
      return event
  }
}

/**
 * Plays scripted scenarios as if a server were sending them. Each step is stamped
 * with a unique id and the current time when it is emitted.
 */
export function createMockEventSource(
  scheduler: Scheduler,
  options: { pendingApprovals?: readonly Approval[] } = {},
): AgentEventSource {
  const listeners = new Set<(event: AgentEvent) => void>()
  const timers = new Set<unknown>()
  const approvalAgents = new Map<string, string>()
  let counter = 0

  const nextId = (prefix: string) => {
    counter += 1
    return `${prefix}-${counter}`
  }

  function emit(event: AgentEvent) {
    listeners.forEach((listener) => listener(event))
  }

  function play(steps: readonly ScenarioStep[]) {
    let delay = 0
    for (const step of steps) {
      delay += step.delayMs
      const handle = scheduler.setTimeout(() => {
        timers.delete(handle)
        const at = scheduler.now()
        emit({ ...stampTimes(step.event, at), id: nextId('mock-evt'), at } as AgentEvent)
      }, delay)
      timers.add(handle)
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      // Replay the requests already waiting when the interface connects.
      for (const approval of options.pendingApprovals ?? []) {
        approvalAgents.set(approval.id, approval.agentId)
        listener({ id: `mock-seed-${approval.id}`, at: scheduler.now(), type: 'approval.requested', approval })
      }
      return () => listeners.delete(listener)
    },
    submitCommand(command) {
      play(commandScenario(command, { task: nextId('task'), execution: nextId('exec'), handoff: nextId('handoff') }))
    },
    decide(approvalId: string, decision: ApprovalDecision) {
      const agentId = approvalAgents.get(approvalId)
      if (!agentId) return
      approvalAgents.delete(approvalId)
      play(decisionScenario(agentId, approvalId, decision))
    },
    dispose() {
      timers.forEach((handle) => scheduler.clearTimeout(handle))
      timers.clear()
      listeners.clear()
    },
  }
}
