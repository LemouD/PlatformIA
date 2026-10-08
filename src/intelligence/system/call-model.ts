import { compileOutputSchema } from '../definitions/compile-schema'
import type { AllowedModel, Effort, JsonSchema } from '../definitions/types'
import { createEventFactory } from '../events'
import { appendAudit } from '../lifecycle/service'
import { estimateMaxCostUsd, startOfDay, startOfMonth } from '../limits/budget'
import { CEILINGS } from '../limits/ceilings'
import { costUsd, resolveAllowedModel } from '../limits/pricing'
import type { LlmRequest } from '../ports'
import type { ErrorCode } from '../records'
import type { EngineDeps } from '../runner/run-agent'

export const SYSTEM_AGENT_IDS = { creator: 'system:creator', router: 'system:nova' } as const

const SYSTEM_MODEL: AllowedModel = 'claude-opus-5-5'

export interface SystemCallRequest {
  agentId: string
  system: string
  text: string
  outputSchema: JsonSchema
  maxOutputTokens: number
  effort: Effort
}

export type SystemCallResult = { ok: true; json: unknown } | { ok: false; errorCode: ErrorCode; details: string[] }

/** One model call for an internal system agent. No tools, budget reserved first, cost recorded, input not stored. */
export async function callSystemModel(deps: EngineDeps, request: SystemCallRequest): Promise<SystemCallResult> {
  const now = deps.clock.now()
  const size = {
    textChars: request.system.length + request.text.length,
    schemaChars: JSON.stringify(request.outputSchema).length,
    images: 0,
    pdfPages: 0,
    maxOutputTokens: request.maxOutputTokens,
  }
  const attemptCost = estimateMaxCostUsd(SYSTEM_MODEL, { ...size, attempts: 1 })
  // Two attempts are reserved: a transient error is retried once.
  const maxCost = estimateMaxCostUsd(SYSTEM_MODEL, { ...size, attempts: 2 })
  const reservation = await deps.budget.reserve(
    maxCost,
    async () => (await deps.executions.sumUsageSince(startOfMonth(now))).costUsd,
    deps.settings.monthlyBudgetUsd,
  )
  if (!reservation) {
    await appendAudit(deps, 'engine', 'run_refused', request.agentId, { errorCode: 'monthly_budget_reached' })
    return { ok: false, errorCode: 'monthly_budget_reached', details: [] }
  }

  try {
    const llmRequest: LlmRequest = {
      model: SYSTEM_MODEL,
      effort: request.effort,
      system: request.system,
      content: [{ type: 'text', text: request.text }],
      outputSchema: request.outputSchema,
      maxOutputTokens: request.maxOutputTokens,
      timeoutMs: Math.min(deps.settings.llmTimeoutMs, CEILINGS.llmTimeoutMs),
    }
    const startedAt = deps.clock.now()
    let result = await deps.llm.complete(llmRequest)
    // A request that timed out may still have been billed: count it at its maximum cost.
    let timedOutAttempts = result.kind === 'error' && result.cause === 'timeout' ? 1 : 0
    if (result.kind === 'error' && result.retryable) {
      result = await deps.llm.complete(llmRequest)
      if (result.kind === 'error' && result.cause === 'timeout') timedOutAttempts += 1
    }

    let outcome: SystemCallResult
    if (result.kind === 'error') outcome = { ok: false, errorCode: 'model_unavailable', details: [result.cause] }
    else if (result.kind === 'refused') outcome = { ok: false, errorCode: 'model_refused', details: [] }
    else if (result.kind === 'truncated') outcome = { ok: false, errorCode: 'output_truncated', details: [] }
    else if (result.kind === 'invalid_json') outcome = { ok: false, errorCode: 'output_invalid', details: [] }
    else if (!resolveAllowedModel(result.model)) {
      outcome = { ok: false, errorCode: 'model_not_allowed', details: [result.model] }
      await appendAudit(deps, 'engine', 'model_not_allowed', request.agentId, { model: result.model })
    } else if (!compileOutputSchema(request.outputSchema)?.(result.json)) {
      outcome = { ok: false, errorCode: 'output_invalid', details: [] }
    } else outcome = { ok: true, json: result.json }

    const usage = result.kind === 'error' ? { inputTokens: 0, outputTokens: 0 } : result.usage
    await deps.executions.insert({
      id: deps.newId(),
      agentId: request.agentId,
      agentVersion: 1,
      mode: 'live',
      origin: 'system',
      input: {},
      attachments: [],
      output: null,
      status: outcome.ok ? 'succeeded' : 'failed',
      errorCode: outcome.ok ? null : outcome.errorCode,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: costUsd(SYSTEM_MODEL, usage.inputTokens, usage.outputTokens) + timedOutAttempts * attemptCost,
      model: result.kind === 'error' ? null : result.model,
      startedAt,
      finishedAt: deps.clock.now(),
    })
    const today = await deps.executions.sumUsageSince(startOfDay(now))
    deps.events.emit(createEventFactory(deps.clock, deps.newId).metrics({ tokens: today.tokens, costTodayUsd: today.costUsd }))
    return outcome
  } finally {
    reservation.release()
  }
}
