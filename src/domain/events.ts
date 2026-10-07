import type { Agent, AgentAvailability, AgentStatus, SystemMetrics } from './types'

/**
 * Contract between the server (engine and routes) and the interface store.
 * Every change to agents, tasks, executions, handoffs, approvals, logs and metrics
 * reaches the interface as one of these events, in order.
 */

export type TaskStatus = 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed'

export interface Task {
  id: string
  title: string
  status: TaskStatus
  agentId: string
  /** Between 0 and 100. */
  progress: number
  createdAt: number
  startedAt: number | null
  completedAt: number | null
}

export type ExecutionMode = 'test' | 'live'
export type ExecutionOrigin = 'form' | 'nova'
export type ExecutionResult = 'succeeded' | 'failed' | 'refused'

export interface Execution {
  id: string
  agentId: string
  taskId: string | null
  mode: ExecutionMode
  origin: ExecutionOrigin
  startedAt: number
}

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

export interface ExecutionStep {
  id: string
  executionId: string
  /** Short upper-case stage name shown in the timeline, e.g. "REQUEST", "LLM GENERATION". */
  label: string
  status: StepStatus
  timestamp: number
  message: string
  metadata?: Record<string, string | number | boolean>
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Log {
  id: string
  executionId: string | null
  level: LogLevel
  /** Dotted component name, e.g. "engine.runner", "router.nova". */
  component: string
  timestamp: number
  message: string
}

export interface Handoff {
  id: string
  fromAgentId: string
  toAgentId: string
  /** Why the work moves, e.g. the routing reason given by NOVA. Plain text. */
  label: string
  startedAt: number
}

export interface Approval {
  id: string
  agentId: string
  executionId: string | null
  /** What the user is asked to approve. Plain text. */
  summary: string
  requestedAt: number
  /** What the agent will do if approved, e.g. "Send one email". Plain text. */
  action?: string
  /** Data the action reads or sends, e.g. "Draft from Personal Agent". Plain text. */
  dataUsed?: string
  /** True when approving makes something leave AI OS (email, message, upload). */
  leavesAiOs?: boolean
  /** Content the user is about to approve, shown verbatim as plain text. */
  preview?: string
}

interface EventBase {
  /** Unique per event, used to drop duplicates. */
  id: string
  /** Epoch milliseconds, set by the server. */
  at: number
}

export type AgentEvent = EventBase &
  (
    | { type: 'agent.registered'; agent: Agent }
    | { type: 'agent.removed'; agentId: string }
    | {
        type: 'agent.status_changed'
        agentId: string
        status: AgentStatus
        /** New activity line; unchanged when absent. */
        activity?: string
        executionId?: string
      }
    | { type: 'agent.availability_changed'; agentId: string; availability: AgentAvailability }
    | { type: 'task.created'; task: Task }
    | { type: 'task.updated'; taskId: string; status?: TaskStatus; progress?: number }
    | { type: 'execution.started'; execution: Execution }
    | { type: 'execution.step'; step: ExecutionStep }
    | {
        type: 'execution.finished'
        executionId: string
        result: ExecutionResult
        /** One of the engine error codes when the result is not "succeeded". */
        errorCode?: string
        tokensIn: number
        tokensOut: number
        costUsd: number
      }
    | { type: 'handoff.started'; handoff: Handoff }
    | { type: 'handoff.completed'; handoffId: string }
    | { type: 'approval.requested'; approval: Approval }
    | { type: 'approval.resolved'; approvalId: string; decision: 'approved' | 'rejected' }
    | { type: 'log.appended'; log: Log }
    | { type: 'metrics.updated'; metrics: Partial<SystemMetrics> }
  )

export type AgentEventType = AgentEvent['type']

export type AgentEventOf<T extends AgentEventType> = Extract<AgentEvent, { type: T }>

export const AGENT_EVENT_TYPES = [
  'agent.registered',
  'agent.removed',
  'agent.status_changed',
  'agent.availability_changed',
  'task.created',
  'task.updated',
  'execution.started',
  'execution.step',
  'execution.finished',
  'handoff.started',
  'handoff.completed',
  'approval.requested',
  'approval.resolved',
  'log.appended',
  'metrics.updated',
] as const satisfies readonly AgentEventType[]

/** Compile-time guard: fails to type-check if a type is missing from AGENT_EVENT_TYPES. */
type MissingEventTypes = Exclude<AgentEventType, (typeof AGENT_EVENT_TYPES)[number]>
export const EVENT_TYPES_COMPLETE: MissingEventTypes extends never ? true : false = true
