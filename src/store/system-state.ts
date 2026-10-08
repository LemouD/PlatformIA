import type { AgentEvent, Approval, Execution, ExecutionResult, ExecutionStep, Handoff, Log, Task } from '@/domain/events'
import { sanitizeText, TEXT_LIMITS } from '@/domain/sanitize'
import { canTransition } from '@/domain/state-machine'
import type { ActivityEntry, Agent, AgentStatus, SystemHealth, SystemMetrics, Tone } from '@/domain/types'

export interface ExecutionRecord {
  execution: Execution
  steps: ExecutionStep[]
  result: ExecutionResult | null
  errorCode: string | null
  finishedAt: number | null
  tokens: number
  costUsd: number
}

/** Everything the interface knows about the system, built only from events. */
export interface SystemState {
  agents: Agent[]
  tasks: Task[]
  executions: Record<string, ExecutionRecord>
  handoffs: Handoff[]
  approvals: Approval[]
  logs: Log[]
  activity: ActivityEntry[]
  metrics: SystemMetrics
  health: SystemHealth
  lastEventAt: number | null
  seenEventIds: string[]
}

export const LIMITS = {
  logs: 500,
  activity: 50,
  seenEvents: 500,
} as const

/** Activity line written when an agent enters a status; IDLE is too frequent to be worth a line. */
const STATUS_ACTIVITY: Partial<Record<AgentStatus, { tone: Tone; verb: string }>> = {
  THINKING: { tone: 'info', verb: 'is thinking' },
  WORKING: { tone: 'accent', verb: 'is working' },
  WAITING_APPROVAL: { tone: 'warning', verb: 'is waiting for approval' },
  ERROR: { tone: 'danger', verb: 'ran into an error' },
  COMPLETED: { tone: 'success', verb: 'finished' },
}

export function createInitialState(agents: readonly Agent[], metrics: SystemMetrics): SystemState {
  return {
    agents: [...agents],
    tasks: [],
    executions: {},
    handoffs: [],
    approvals: [],
    logs: [],
    activity: [],
    metrics,
    health: 'nominal',
    lastEventAt: null,
    seenEventIds: [],
  }
}

const short = (text: string) => sanitizeText(text, TEXT_LIMITS.short)
const message = (text: string) => sanitizeText(text, TEXT_LIMITS.message)

function keepLast<T>(items: T[], limit: number): T[] {
  return items.length > limit ? items.slice(items.length - limit) : items
}

function nameOf(state: SystemState, agentId: string): string {
  return state.agents.find((agent) => agent.id === agentId)?.name ?? 'Unknown agent'
}

function addActivity(state: SystemState, event: AgentEvent, tone: Tone, text: string): SystemState {
  const entry: ActivityEntry = { id: `activity-${event.id}`, timestamp: event.at, tone, message: message(text) }
  return { ...state, activity: keepLast([...state.activity, entry], LIMITS.activity) }
}

/** Records a refused event in the logs instead of applying it. */
function reject(state: SystemState, event: AgentEvent, reason: string): SystemState {
  const log: Log = {
    id: `log-${event.id}`,
    executionId: null,
    level: 'warn',
    component: 'interface.store',
    timestamp: event.at,
    message: message(`Ignored ${event.type}: ${reason}`),
  }
  return { ...state, logs: keepLast([...state.logs, log], LIMITS.logs) }
}

function hasAgent(state: SystemState, agentId: string): boolean {
  return state.agents.some((agent) => agent.id === agentId)
}

function sanitizeAgent(agent: Agent): Agent {
  return {
    ...agent,
    name: short(agent.name),
    activity: short(agent.activity),
    description: message(agent.description),
  }
}

function reduce(state: SystemState, event: AgentEvent): SystemState {
  switch (event.type) {
    case 'agent.registered': {
      const agent = sanitizeAgent(event.agent)
      const others = state.agents.filter((existing) => existing.id !== agent.id)
      return { ...state, agents: [...others, agent] }
    }

    case 'agent.removed':
      if (!hasAgent(state, event.agentId)) return reject(state, event, 'unknown agent')
      return { ...state, agents: state.agents.filter((agent) => agent.id !== event.agentId) }

    case 'agent.status_changed': {
      const agent = state.agents.find((candidate) => candidate.id === event.agentId)
      if (!agent) return reject(state, event, 'unknown agent')
      if (!canTransition(agent.status, event.status)) {
        return reject(state, event, `${agent.status} → ${event.status} is not allowed`)
      }
      const updated: Agent = {
        ...agent,
        status: event.status,
        activity: event.activity === undefined ? agent.activity : short(event.activity),
      }
      const next = { ...state, agents: state.agents.map((candidate) => (candidate.id === agent.id ? updated : candidate)) }
      const line = STATUS_ACTIVITY[event.status]
      if (!line || agent.status === event.status) return next
      return addActivity(next, event, line.tone, `${agent.name} ${line.verb}`)
    }

    case 'agent.availability_changed': {
      if (!hasAgent(state, event.agentId)) return reject(state, event, 'unknown agent')
      return {
        ...state,
        agents: state.agents.map((agent) =>
          agent.id === event.agentId ? { ...agent, availability: event.availability } : agent,
        ),
      }
    }

    case 'task.created': {
      if (!hasAgent(state, event.task.agentId)) return reject(state, event, 'unknown agent')
      const task: Task = { ...event.task, title: short(event.task.title) }
      const next = { ...state, tasks: [...state.tasks.filter((existing) => existing.id !== task.id), task] }
      return addActivity(next, event, 'info', `New task for ${nameOf(state, task.agentId)}: ${task.title}`)
    }

    case 'task.updated': {
      if (!state.tasks.some((task) => task.id === event.taskId)) return reject(state, event, 'unknown task')
      return {
        ...state,
        tasks: state.tasks.map((task) => {
          if (task.id !== event.taskId) return task
          const status = event.status ?? task.status
          const finished = status === 'completed' || status === 'failed'
          return {
            ...task,
            status,
            progress: event.progress === undefined ? task.progress : Math.min(100, Math.max(0, event.progress)),
            completedAt: finished ? (task.completedAt ?? event.at) : null,
          }
        }),
      }
    }

    case 'execution.started': {
      if (!hasAgent(state, event.execution.agentId)) return reject(state, event, 'unknown agent')
      const record: ExecutionRecord = {
        execution: event.execution,
        steps: [],
        result: null,
        errorCode: null,
        finishedAt: null,
        tokens: 0,
        costUsd: 0,
      }
      return { ...state, executions: { ...state.executions, [event.execution.id]: record } }
    }

    case 'execution.step': {
      const record = state.executions[event.step.executionId]
      if (!record) return reject(state, event, 'unknown execution')
      const step: ExecutionStep = { ...event.step, label: short(event.step.label), message: message(event.step.message) }
      const steps = [...record.steps.filter((existing) => existing.id !== step.id), step]
      return { ...state, executions: { ...state.executions, [step.executionId]: { ...record, steps } } }
    }

    case 'execution.finished': {
      const record = state.executions[event.executionId]
      if (!record) return reject(state, event, 'unknown execution')
      const finished: ExecutionRecord = {
        ...record,
        result: event.result,
        errorCode: event.errorCode === undefined ? null : short(event.errorCode),
        finishedAt: event.at,
        tokens: event.tokensIn + event.tokensOut,
        costUsd: event.costUsd,
      }
      const next = { ...state, executions: { ...state.executions, [event.executionId]: finished } }
      if (event.result === 'succeeded') return next
      return addActivity(
        next,
        event,
        'danger',
        `${nameOf(state, record.execution.agentId)} execution ${event.result}${finished.errorCode ? ` (${finished.errorCode})` : ''}`,
      )
    }

    case 'handoff.started': {
      const { handoff } = event
      if (!hasAgent(state, handoff.fromAgentId) || !hasAgent(state, handoff.toAgentId)) {
        return reject(state, event, 'unknown agent')
      }
      const clean: Handoff = { ...handoff, label: short(handoff.label) }
      const next = { ...state, handoffs: [...state.handoffs.filter((existing) => existing.id !== clean.id), clean] }
      return addActivity(
        next,
        event,
        'info',
        `${nameOf(state, clean.fromAgentId)} handed the task to ${nameOf(state, clean.toAgentId)}`,
      )
    }

    case 'handoff.completed':
      return { ...state, handoffs: state.handoffs.filter((handoff) => handoff.id !== event.handoffId) }

    case 'approval.requested': {
      const { approval } = event
      if (!hasAgent(state, approval.agentId)) return reject(state, event, 'unknown agent')
      const clean: Approval = {
        ...approval,
        summary: short(approval.summary),
        action: approval.action === undefined ? undefined : short(approval.action),
        dataUsed: approval.dataUsed === undefined ? undefined : short(approval.dataUsed),
        preview: approval.preview === undefined ? undefined : sanitizeText(approval.preview, TEXT_LIMITS.preview),
      }
      const next = { ...state, approvals: [...state.approvals.filter((existing) => existing.id !== clean.id), clean] }
      return addActivity(next, event, 'warning', `${nameOf(state, clean.agentId)} asks for approval`)
    }

    case 'approval.resolved': {
      const approval = state.approvals.find((candidate) => candidate.id === event.approvalId)
      if (!approval) return reject(state, event, 'unknown approval')
      const next = { ...state, approvals: state.approvals.filter((candidate) => candidate.id !== event.approvalId) }
      return addActivity(
        next,
        event,
        event.decision === 'approved' ? 'success' : 'danger',
        `Request from ${nameOf(state, approval.agentId)} ${event.decision}`,
      )
    }

    case 'log.appended': {
      const log: Log = { ...event.log, component: short(event.log.component), message: message(event.log.message) }
      return { ...state, logs: keepLast([...state.logs, log], LIMITS.logs) }
    }

    case 'metrics.updated':
      return { ...state, metrics: { ...state.metrics, ...event.metrics } }
  }
}

/** Applies one event. Duplicates are dropped; invalid events are logged, never thrown. */
export function applyEvent(state: SystemState, event: AgentEvent): SystemState {
  if (state.seenEventIds.includes(event.id)) return state
  const next = reduce(state, event)
  return {
    ...next,
    lastEventAt: Math.max(state.lastEventAt ?? 0, event.at),
    seenEventIds: keepLast([...state.seenEventIds, event.id], LIMITS.seenEvents),
  }
}
