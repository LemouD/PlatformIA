import { prepareAttachment, type PreparedAttachment } from '../attachments/prepare'
import { compileOutputSchema } from '../definitions/compile-schema'
import { stripInvisibleValues } from '../definitions/invisible'
import type { ConfiguredAgent } from '../definitions/types'
import { createEventFactory, type EventFactory, type EventSink } from '../events'
import { appendAudit } from '../lifecycle/service'
import { allowsMode } from '../lifecycle/transitions'
import { type BudgetGuard, estimateMaxCostUsd, startOfDay, startOfMonth } from '../limits/budget'
import { CEILINGS } from '../limits/ceilings'
import { costUsd, resolveAllowedModel } from '../limits/pricing'
import type { AgentStore, AuditLog, Clock, ExecutionStore, LlmClient, LlmRequest, LlmResult } from '../ports'
import type { ErrorCode, ExecutionMode, ExecutionRecord } from '../records'
import { buildUserContent, validateRunInput } from './input'

export interface EngineSettings {
  monthlyBudgetUsd: number
  llmTimeoutMs: number
}

export interface EngineDeps {
  agents: AgentStore
  executions: ExecutionStore
  audit: AuditLog
  clock: Clock
  newId: () => string
  llm: LlmClient
  events: EventSink
  budget: BudgetGuard
  settings: EngineSettings
}

export interface RunRequest {
  agentId: string
  mode: ExecutionMode
  origin: 'form' | 'nova'
  fields: Record<string, string>
  attachments: { fieldKey: string; name: string; bytes: Uint8Array }[]
}

export type RunResult =
  /** inputSanitized: invisible characters were removed from the form values before sending. */
  | { ok: true; executionId: string; output: unknown; inputSanitized: boolean }
  | { ok: false; errorCode: ErrorCode; executionId: string | null; details: string[] }

const COMPONENT = 'engine.runner'

/** Stops a run before any model call: one log line, one audit line, no status change. */
async function refuse(
  deps: EngineDeps,
  ev: EventFactory,
  request: RunRequest,
  agent: ConfiguredAgent | null,
  errorCode: ErrorCode,
  details: string[] = [],
): Promise<RunResult> {
  const now = deps.clock.now()
  let executionId: string | null = null
  if (agent) {
    executionId = deps.newId()
    await deps.executions.insert({
      id: executionId,
      agentId: agent.id,
      agentVersion: agent.version,
      mode: request.mode,
      origin: request.origin,
      input: {},
      attachments: [],
      output: null,
      status: 'refused',
      errorCode,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      model: null,
      startedAt: now,
      finishedAt: now,
    })
  }
  deps.events.emit(ev.log('warn', COMPONENT, `run refused: ${errorCode}`))
  await appendAudit(deps, 'engine', 'run_refused', agent?.id ?? null, { errorCode, mode: request.mode })
  return { ok: false, errorCode, executionId, details }
}

function outcomeOf(agent: ConfiguredAgent, result: LlmResult): { errorCode: ErrorCode | null; details: string[] } {
  switch (result.kind) {
    case 'error':
      return { errorCode: 'model_unavailable', details: [result.cause] }
    case 'refused':
      return { errorCode: 'model_refused', details: [] }
    case 'truncated':
      return { errorCode: 'output_truncated', details: [] }
    case 'invalid_json':
      return { errorCode: 'output_invalid', details: [] }
    case 'ok': {
      if (!resolveAllowedModel(result.model)) return { errorCode: 'model_not_allowed', details: [result.model] }
      const validate = compileOutputSchema(agent.outputSchema)
      if (!validate) return { errorCode: 'output_invalid', details: ['schéma de sortie hors du sous-ensemble accepté'] }
      return validate(result.json) ? { errorCode: null, details: [] } : { errorCode: 'output_invalid', details: [] }
    }
  }
}

export async function runAgent(deps: EngineDeps, request: RunRequest): Promise<RunResult> {
  const ev = createEventFactory(deps.clock, deps.newId)
  const now = deps.clock.now()

  const stored = await deps.agents.get(request.agentId)
  if (!stored || stored.family !== 'configured') return refuse(deps, ev, request, null, 'agent_not_found')
  const agent = stored
  if (!allowsMode(agent.lifecycle, request.mode)) return refuse(deps, ev, request, agent, 'lifecycle_forbidden')
  if (agent.availability === 'paused') return refuse(deps, ev, request, agent, 'agent_paused')
  if ((await deps.executions.countRunsSince(agent.id, startOfDay(now))) >= agent.limits.maxRunsPerDay) {
    return refuse(deps, ev, request, agent, 'daily_quota_reached')
  }

  // Text pasted from an e-mail or a web page may hide instructions in invisible characters.
  const cleaned = stripInvisibleValues(request.fields)
  const input = validateRunInput(
    agent.inputFields,
    cleaned.values,
    request.attachments.map((a) => a.fieldKey),
  )
  if (!input.ok) return refuse(deps, ev, request, agent, 'invalid_input', input.errors)

  if (request.attachments.length > CEILINGS.attachmentsPerRun) {
    return refuse(deps, ev, request, agent, 'attachment_rejected', [`${CEILINGS.attachmentsPerRun} pièces jointes au plus`])
  }
  const prepared: PreparedAttachment[] = []
  for (const attachment of request.attachments) {
    const result = await prepareAttachment(attachment.fieldKey, attachment.name, attachment.bytes)
    if (!result.ok) return refuse(deps, ev, request, agent, 'attachment_rejected', [`${attachment.fieldKey}: ${result.reason}`])
    prepared.push(result.value)
  }

  const content = buildUserContent(input.values, prepared)
  const textChars =
    agent.systemPrompt.length + content.reduce((n, b) => n + (b.type === 'text' ? b.text.length : 0), 0)
  const size = {
    textChars,
    schemaChars: JSON.stringify(agent.outputSchema).length,
    images: prepared.filter((p) => p.block.type === 'image').length,
    pdfPages: prepared.filter((p) => p.block.type === 'pdf').reduce((n, p) => n + p.pages, 0),
    maxOutputTokens: agent.limits.maxOutputTokens,
  }
  const attemptCost = estimateMaxCostUsd(agent.model, { ...size, attempts: 1 })
  // Two attempts are reserved: a transient error is retried once.
  const maxCost = estimateMaxCostUsd(agent.model, { ...size, attempts: 2 })
  const monthStart = startOfMonth(now)
  const reservation = await deps.budget.reserve(
    maxCost,
    async () => (await deps.executions.sumUsageSince(monthStart)).costUsd,
    deps.settings.monthlyBudgetUsd,
  )
  if (!reservation) return refuse(deps, ev, request, agent, 'monthly_budget_reached')

  try {
    const executionId = deps.newId()
    const startedAt = deps.clock.now()
    deps.events.emit(ev.executionStarted(agent.id, executionId, request.mode, request.origin))
    deps.events.emit(ev.statusChanged(agent.id, 'THINKING', 'Calling the model', executionId))
    deps.events.emit(ev.executionStep(executionId, 'LLM GENERATION', 'running', 'Request sent'))

    const llmRequest: LlmRequest = {
      model: agent.model,
      effort: agent.effort,
      system: agent.systemPrompt,
      content,
      outputSchema: agent.outputSchema,
      maxOutputTokens: agent.limits.maxOutputTokens,
      timeoutMs: Math.min(deps.settings.llmTimeoutMs, CEILINGS.llmTimeoutMs),
    }
    let result = await deps.llm.complete(llmRequest)
    // A request that timed out may still have been billed: count it at its maximum cost.
    let timedOutAttempts = result.kind === 'error' && result.cause === 'timeout' ? 1 : 0
    if (result.kind === 'error' && result.retryable) {
      result = await deps.llm.complete(llmRequest)
      if (result.kind === 'error' && result.cause === 'timeout') timedOutAttempts += 1
    }
    const generated = result.kind === 'ok' || result.kind === 'invalid_json'
    deps.events.emit(
      ev.executionStep(executionId, 'LLM GENERATION', generated ? 'success' : 'failed', generated ? 'Response received' : 'No usable response'),
    )

    const { errorCode, details } = outcomeOf(agent, result)
    deps.events.emit(
      ev.executionStep(
        executionId,
        'VALIDATION',
        errorCode === null ? 'success' : generated ? 'failed' : 'skipped',
        errorCode === null ? 'Response validated' : `Rejected: ${errorCode}`,
      ),
    )

    const usage = result.kind === 'error' ? { inputTokens: 0, outputTokens: 0 } : result.usage
    const reportedModel = result.kind === 'error' ? null : result.model
    const pricedModel = (reportedModel && resolveAllowedModel(reportedModel)) || agent.model
    const record: ExecutionRecord = {
      id: executionId,
      agentId: agent.id,
      agentVersion: agent.version,
      mode: request.mode,
      origin: request.origin,
      input: input.values,
      attachments: prepared.map((p) => p.meta),
      output: errorCode === null && result.kind === 'ok' ? result.json : null,
      status: errorCode === null ? 'succeeded' : 'failed',
      errorCode,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: costUsd(pricedModel, usage.inputTokens, usage.outputTokens) + timedOutAttempts * attemptCost,
      model: reportedModel,
      startedAt,
      finishedAt: deps.clock.now(),
    }
    await deps.executions.insert(record)

    deps.events.emit(
      ev.executionFinished(executionId, record.status === 'succeeded' ? 'succeeded' : 'failed', {
        errorCode,
        tokensIn: record.inputTokens,
        tokensOut: record.outputTokens,
        costUsd: record.costUsd,
      }),
    )
    if (errorCode === null) {
      deps.events.emit(ev.statusChanged(agent.id, 'COMPLETED', 'Run completed', executionId))
    } else {
      deps.events.emit(ev.statusChanged(agent.id, 'ERROR', `Run failed: ${errorCode}`, executionId))
      deps.events.emit(ev.log('error', COMPONENT, `run failed: ${errorCode}`, executionId))
      if (errorCode === 'model_not_allowed') {
        await appendAudit(deps, 'engine', 'model_not_allowed', agent.id, { model: details[0] ?? '' })
      }
    }
    const today = await deps.executions.sumUsageSince(startOfDay(now))
    deps.events.emit(ev.metrics({ tokens: today.tokens, costTodayUsd: today.costUsd }))

    return errorCode === null
      ? { ok: true, executionId, output: record.output, inputSanitized: cleaned.stripped }
      : { ok: false, errorCode, executionId, details }
  } finally {
    reservation.release()
  }
}
