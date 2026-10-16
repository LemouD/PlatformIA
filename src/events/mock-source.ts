import type { AgentEvent, AgentEventInput, Approval } from '@/domain/events'
import { commandScenario, decisionScenario } from '@/mocks/scenarios'
import type { ScenarioStep } from '@/mocks/scenarios'
import type { Scheduler } from '@/store/scheduler'
import type { AgentEventSource, ApprovalDecision, ConnectionState } from './source'

/** Delay before the mock tries to reconnect after an outage, like the server source will. */
export const MOCK_RETRY_MS = 5000

export interface MockEventSource extends AgentEventSource {
  /** Simulates a cut of the live stream; it comes back on its own after MOCK_RETRY_MS. */
  interrupt(): void
}

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
): MockEventSource {
  const listeners = new Set<(event: AgentEvent) => void>()
  const connectionListeners = new Set<(connection: ConnectionState) => void>()
  const timers = new Set<unknown>()
  const approvalAgents = new Map<string, string>()
  let counter = 0
  let connection: ConnectionState = { status: 'live' }
  let retryTimer: unknown = null
  // While the stream is cut, events wait here and the user's actions wait to be sent.
  let heldEvents: AgentEvent[] = []
  let heldActions: (() => void)[] = []

  const nextId = (prefix: string) => {
    counter += 1
    return `${prefix}-${counter}`
  }

  function emit(event: AgentEvent) {
    if (connection.status === 'interrupted') {
      heldEvents.push(event)
      return
    }
    listeners.forEach((listener) => listener(event))
  }

  function setConnection(next: ConnectionState) {
    connection = next
    connectionListeners.forEach((listener) => listener(next))
  }

  function whenLive(action: () => void) {
    if (connection.status === 'interrupted') heldActions.push(action)
    else action()
  }

  function reconnect() {
    if (connection.status === 'live') return
    if (retryTimer !== null) scheduler.clearTimeout(retryTimer)
    retryTimer = null
    setConnection({ status: 'live' })
    const events = heldEvents
    const actions = heldActions
    heldEvents = []
    heldActions = []
    events.forEach(emit)
    actions.forEach((action) => action())
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
    subscribeConnection(listener) {
      connectionListeners.add(listener)
      listener(connection)
      return () => connectionListeners.delete(listener)
    },
    reconnect,
    interrupt() {
      if (connection.status === 'interrupted') return
      const retryAt = scheduler.now() + MOCK_RETRY_MS
      retryTimer = scheduler.setTimeout(reconnect, MOCK_RETRY_MS)
      setConnection({ status: 'interrupted', retryAt })
    },
    submitCommand(command) {
      whenLive(() =>
        play(commandScenario(command, { task: nextId('task'), execution: nextId('exec'), handoff: nextId('handoff') })),
      )
    },
    decide(approvalId: string, decision: ApprovalDecision) {
      const agentId = approvalAgents.get(approvalId)
      if (!agentId) return
      approvalAgents.delete(approvalId)
      whenLive(() => play(decisionScenario(agentId, approvalId, decision)))
    },
    setAvailability(agentId, availability) {
      whenLive(() => play([{ delayMs: 200, event: { type: 'agent.availability_changed', agentId, availability } }]))
    },
    dispose() {
      timers.forEach((handle) => scheduler.clearTimeout(handle))
      timers.clear()
      if (retryTimer !== null) scheduler.clearTimeout(retryTimer)
      listeners.clear()
      connectionListeners.clear()
    },
  }
}
