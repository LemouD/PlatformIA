import type { AgentEventInput } from '@/domain/events'

export interface ScenarioStep {
  /** Delay after the previous step, in ms. */
  delayMs: number
  event: AgentEventInput
}

const NOVA = 'nova'

/** Keyword routing that stands in for NOVA until the real router is connected. */
const ROUTES: readonly { agentId: string; keywords: readonly string[] }[] = [
  { agentId: 'home', keywords: ['light', 'lamp', 'home', 'house', 'heating', 'lumière', 'maison'] },
  { agentId: 'coding', keywords: ['code', 'bug', 'repo', 'github', 'patch', 'test'] },
  { agentId: 'personal', keywords: ['menu', 'calendar', 'meeting', 'family', 'agenda', 'repas'] },
  { agentId: 'research', keywords: ['research', 'news', 'document', 'analy', 'search', 'veille'] },
]

export function routeMockCommand(command: string): string | null {
  // Keywords match at the start of a word, so "latest" does not count as "test".
  const words = command.toLowerCase().split(/[^\p{L}\p{N}]+/u)
  const matches = (keyword: string) => words.some((word) => word.startsWith(keyword))
  return ROUTES.find((route) => route.keywords.some(matches))?.agentId ?? null
}

/** NOVA routes the command, then the chosen agent runs one execution to completion. */
export function commandScenario(command: string, ids: { task: string; execution: string; handoff: string }): ScenarioStep[] {
  const agentId = routeMockCommand(command)
  const thinking: ScenarioStep = {
    delayMs: 0,
    event: { type: 'agent.status_changed', agentId: NOVA, status: 'THINKING', activity: 'Routing your command' },
  }

  if (agentId === null) {
    return [
      thinking,
      {
        delayMs: 1200,
        event: { type: 'agent.status_changed', agentId: NOVA, status: 'COMPLETED', activity: 'No suitable agent found' },
      },
      {
        delayMs: 0,
        event: {
          type: 'log.appended',
          log: {
            id: `${ids.execution}-log`,
            executionId: null,
            level: 'info',
            component: 'router.nova',
            timestamp: 0,
            message: `No agent fits the command: ${command}`,
          },
        },
      },
    ]
  }

  const step = (label: string, status: 'running' | 'success', message: string, index: number): ScenarioStep => ({
    delayMs: 700,
    event: {
      type: 'execution.step',
      step: { id: `${ids.execution}-step-${index}`, executionId: ids.execution, label, status, timestamp: 0, message },
    },
  })

  const log = (
    level: 'debug' | 'info' | 'warn',
    component: string,
    message: string,
    index: number,
  ): ScenarioStep => ({
    delayMs: 0,
    event: {
      type: 'log.appended',
      log: { id: `${ids.execution}-log-${index}`, executionId: ids.execution, level, component, timestamp: 0, message },
    },
  })

  return [
    thinking,
    log('debug', 'router.nova', `Routing command to one of 4 candidates`, 0),
    { delayMs: 1200, event: { type: 'agent.status_changed', agentId: NOVA, status: 'COMPLETED', activity: 'Command routed' } },
    log('info', 'router.nova', `Chose ${agentId}`, 1),
    {
      delayMs: 0,
      event: {
        type: 'handoff.started',
        handoff: { id: ids.handoff, fromAgentId: NOVA, toAgentId: agentId, label: command, startedAt: 0 },
      },
    },
    {
      delayMs: 400,
      event: {
        type: 'task.created',
        task: {
          id: ids.task,
          title: command,
          status: 'running',
          agentId,
          progress: 0,
          createdAt: 0,
          startedAt: 0,
          completedAt: null,
        },
      },
    },
    {
      delayMs: 0,
      event: {
        type: 'execution.started',
        execution: { id: ids.execution, agentId, taskId: ids.task, mode: 'live', origin: 'nova', startedAt: 0 },
      },
    },
    { delayMs: 0, event: { type: 'agent.status_changed', agentId, status: 'THINKING', activity: 'Reading the request' } },
    step('REQUEST', 'success', 'Command received from NOVA', 0),
    { delayMs: 1400, event: { type: 'handoff.completed', handoffId: ids.handoff } },
    { delayMs: 0, event: { type: 'agent.status_changed', agentId, status: 'WORKING', activity: 'Working on it' } },
    step('LLM GENERATION', 'running', 'Generating the answer', 1),
    log('info', 'llm.client', 'Request sent · max 2048 output tokens', 2),
    { delayMs: 900, event: { type: 'task.updated', taskId: ids.task, progress: 35 } },
    { delayMs: 1200, event: { type: 'task.updated', taskId: ids.task, progress: 70 } },
    step('VALIDATION', 'success', 'Answer matches the expected format', 2),
    log('info', 'engine.validation', 'Output matches the agent schema', 3),
    {
      delayMs: 600,
      event: {
        type: 'execution.finished',
        executionId: ids.execution,
        result: 'succeeded',
        tokensIn: 1800,
        tokensOut: 650,
        costUsd: 0.02,
      },
    },
    log('info', 'engine.runner', 'Execution succeeded · 1800 in / 650 out tokens · $0.02', 4),
    { delayMs: 0, event: { type: 'task.updated', taskId: ids.task, status: 'completed', progress: 100 } },
    { delayMs: 0, event: { type: 'agent.status_changed', agentId, status: 'COMPLETED', activity: 'Done' } },
  ]
}

/** What happens after the user decides on a pending request. */
export function decisionScenario(
  agentId: string,
  approvalId: string,
  decision: 'approved' | 'rejected',
): ScenarioStep[] {
  const resolved: ScenarioStep = { delayMs: 300, event: { type: 'approval.resolved', approvalId, decision } }
  if (decision === 'rejected') {
    return [resolved, { delayMs: 0, event: { type: 'agent.status_changed', agentId, status: 'IDLE', activity: 'Request refused' } }]
  }
  return [
    resolved,
    { delayMs: 0, event: { type: 'agent.status_changed', agentId, status: 'WORKING', activity: 'Carrying out the approved action' } },
    { delayMs: 2500, event: { type: 'agent.status_changed', agentId, status: 'COMPLETED', activity: 'Action done' } },
  ]
}
