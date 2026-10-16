import type Anthropic from '@anthropic-ai/sdk'
import { stripInvisible } from '@/domain/sanitize'
import { prepareAttachment } from '../attachments/prepare'
import { compileOutputSchema } from '../definitions/compile-schema'
import { appendAudit } from '../lifecycle/service'
import { estimateMaxCostUsd } from '../limits/budget'
import { cachedCostUsd, resolveAllowedModel, type CachedUsage } from '../limits/pricing'
import type { AuditLog, Clock, LlmContentBlock } from '../ports'
import { resetsAt, type BudgetRefusal, type UserBudgets } from './budget'
import type { UserClients } from './clients'
import { summarizeSegment } from './compaction'
import { buildUserMessage, callSize, dataTag, dateLine, toolSpecs } from './context'
import { activeMemories, memoryBlock, memoryChanges } from './memory'
import type {
  ChatRequest,
  ChatResult,
  ConversationProfile,
  ConversationRecord,
  ConversationTool,
  PrivateSpace,
  Session,
  ToolEffect,
  TurnRecord,
  UsageLedger,
} from './types'

export interface ConversationDeps {
  /** Bound to the session's user by the route. */
  space: PrivateSpace
  ledger: UsageLedger
  budgets: UserBudgets
  clientsFor: (userId: string) => UserClients | null
  profiles: Readonly<Record<string, ConversationProfile>>
  audit: AuditLog
  clock: Clock
  newId: () => string
  settings: { timeZone: string }
}

export type ConversationError =
  | 'not_found'
  | 'conflict'
  | 'invalid_input'
  | 'attachment_rejected'
  | 'daily_budget_reached'
  | 'monthly_budget_reached'
  | 'model_unavailable'

export interface SendMessageRequest {
  conversationId: string
  /** Her own words. */
  text: string
  /** Text sent with the "Coller un document" button: always data. */
  pastedText?: string
  /** The interface saw a paste of more than 200 characters in the input field: the whole text is data. */
  pasted?: boolean
  attachments?: { bytes: Uint8Array }[]
  expectedTurnCount: number
}

export type SendMessageResult =
  | {
      ok: true
      reply: string
      /** Why the turn ended early, if it did. */
      stoppedBy: 'refusal' | 'truncated' | 'budget' | 'error' | null
      done: Extract<ToolEffect, { type: 'done' }>[]
      pending: Extract<ToolEffect, { type: 'pending' }>[]
      costUsd: number
      budget: { dailyLeftUsd: number; monthlyLeftUsd: number }
      external: boolean
      turnCount: number
      inputSanitized: boolean
    }
  | { ok: false; error: ConversationError; details: string[]; resetsAt?: number }

const REFUSAL_REPLY = 'Je ne peux pas répondre à cette demande.'
const NOTES: Record<'truncated' | 'budget' | 'error', string> = {
  truncated: '(Réponse coupée.)',
  budget: '(Plafond de dépense atteint : je m’arrête là.)',
  error: '(Le service ne répond plus : je m’arrête là.)',
}

const fail = (error: ConversationError, details: string[] = [], resetAt?: number): SendMessageResult =>
  resetAt === undefined ? { ok: false, error, details } : { ok: false, error, details, resetsAt: resetAt }

/** One turn at a time per conversation, within this server process. */
const busy = new Set<string>()

/** Only security events reach the audit: ordinary actions would already say too much (spec 11.3). */
async function auditSecurity(deps: ConversationDeps, session: Session, profile: ConversationProfile, code: string) {
  await appendAudit(deps, 'engine', 'conversation_security', null, { userId: session.userId, profileId: profile.id, code })
}

export async function startConversation(
  deps: ConversationDeps,
  session: Session,
  profileId: string,
): Promise<{ ok: true; conversation: ConversationRecord } | { ok: false; error: 'not_found' }> {
  const profile = Object.hasOwn(deps.profiles, profileId) ? deps.profiles[profileId] : undefined
  if (!profile || !profile.allowedRoles.includes(session.role)) return { ok: false, error: 'not_found' }
  const now = deps.clock.now()
  const conversation: ConversationRecord = {
    id: deps.newId(),
    profileId,
    createdAt: now,
    updatedAt: now,
    turnCount: 0,
    segment: 0,
    segmentSummary: null,
    external: false,
    memoriesSent: {},
    version: 1,
  }
  await deps.space.conversations.insert(conversation)
  return { ok: true, conversation }
}

function validatorFor(tool: ConversationTool) {
  return compileOutputSchema(tool.inputSchema)
}

function textOf(message: Anthropic.MessageParam): string {
  if (typeof message.content === 'string') return message.content
  return message.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n')
}

export async function sendMessage(
  deps: ConversationDeps,
  session: Session,
  request: SendMessageRequest,
): Promise<SendMessageResult> {
  const conversation = await deps.space.conversations.get(request.conversationId)
  const profile =
    conversation && Object.hasOwn(deps.profiles, conversation.profileId) ? deps.profiles[conversation.profileId] : undefined
  if (!conversation || !profile || !profile.allowedRoles.includes(session.role)) return fail('not_found')

  const lockKey = JSON.stringify([session.userId, conversation.id])
  if (busy.has(lockKey)) return fail('conflict')
  busy.add(lockKey)
  try {
    if (conversation.turnCount !== request.expectedTurnCount) return fail('conflict')
    return await runTurn(deps, session, profile, conversation, request)
  } finally {
    busy.delete(lockKey)
  }
}

async function runTurn(
  deps: ConversationDeps,
  session: Session,
  profile: ConversationProfile,
  initial: ConversationRecord,
  request: SendMessageRequest,
): Promise<SendMessageResult> {
  const limits = profile.limits
  const clients = deps.clientsFor(session.userId)
  if (!clients) return fail('model_unavailable', ['no_api_key'])

  // 1. Input: invisible characters removed, sizes checked, attachments prepared.
  const typedRaw = stripInvisible(request.text)
  const pastedRaw = stripInvisible(request.pastedText ?? '')
  const inputSanitized = typedRaw.stripped || pastedRaw.stripped
  const files = request.attachments ?? []
  if (!typedRaw.value.trim() && !pastedRaw.value.trim() && files.length === 0) return fail('invalid_input', ['empty'])
  if (typedRaw.value.length > limits.textMaxChars || pastedRaw.value.length > limits.textMaxChars) {
    return fail('invalid_input', ['too_long'])
  }
  if (files.length > limits.attachmentsPerTurn) return fail('invalid_input', ['too_many_attachments'])
  const media: LlmContentBlock[] = []
  const mediaCount = { images: 0, pdfPages: 0 }
  for (const [i, file] of files.entries()) {
    const prepared = await prepareAttachment('piece_jointe', `piece-jointe-${i + 1}`, file.bytes)
    if (!prepared.ok) return fail('attachment_rejected', [prepared.reason])
    media.push(prepared.value.block)
    if (prepared.value.block.type === 'pdf') mediaCount.pdfPages += prepared.value.pages
    else mediaCount.images += 1
  }

  // 2. External content: attachment, pasted text, or a message too long to have been typed.
  const typedIsPasted = request.pasted === true || typedRaw.value.length > limits.pastedThresholdChars
  const pastedParts = [pastedRaw.value.trim(), typedIsPasted ? typedRaw.value.trim() : ''].filter(Boolean)
  const turnExternal = media.length > 0 || pastedParts.length > 0
  let conversation: ConversationRecord = initial
  let external = conversation.external || turnExternal

  // 3. Long segment: summary first, then a new segment that replays nothing of the old one.
  let history = await deps.space.turns.listSegment(conversation.id, conversation.segment)
  const last = history.at(-1)
  if (history.length >= limits.compactAfterTurns || (last && last.contextTokens >= limits.compactAfterTokens)) {
    const summary = await summarizeSegment(deps, session, profile, conversation, history)
    if (summary.ok) {
      const next = {
        ...conversation,
        segment: conversation.segment + 1,
        segmentSummary: summary.summary,
        // The new segment re-sends every memory in its first message.
        memoriesSent: {},
        updatedAt: deps.clock.now(),
        version: conversation.version + 1,
      }
      if (!(await deps.space.conversations.compareAndSet(conversation.id, conversation.version, next))) return fail('conflict')
      conversation = next
      history = []
    }
  }

  // 4. The new user message. The summary and the memories open the segment as data; later memory
  // changes are announced in a data line, so the history is never rewritten.
  const opening =
    history.length === 0 && conversation.segmentSummary
      ? [dataTag('resume', { origine: conversation.external ? 'externe' : 'utilisatrice' }, conversation.segmentSummary)]
      : []
  const notes = [dateLine(deps.clock.now(), deps.settings.timeZone)]
  let memoriesSent = conversation.memoriesSent
  if (profile.memory) {
    const memories = await activeMemories(deps.space)
    if (history.length === 0) {
      const block = memoryBlock(memories)
      opening.push(block.text)
      memoriesSent = block.sent
    } else {
      const changes = memoryChanges(conversation.memoriesSent, memories)
      if (changes.text) notes.push(changes.text)
      memoriesSent = changes.sent
    }
  }
  const userMessage = buildUserMessage({
    opening,
    notes,
    attachments: media,
    typed: typedIsPasted ? null : typedRaw.value.trim() || null,
    pasted: pastedParts.length > 0 ? pastedParts.join('\n\n') : null,
  })

  // 5. Model loop. Budget reserved call by call, so one turn never locks most of the daily ceiling.
  const tools = toolSpecs(profile.tools)
  const appended: Anthropic.MessageParam[] = [userMessage]
  const done: Extract<ToolEffect, { type: 'done' }>[] = []
  const pending: Extract<ToolEffect, { type: 'pending' }>[] = []
  let stoppedBy: 'refusal' | 'truncated' | 'budget' | 'error' | null = null
  let calls = 0
  let writes = 0
  let costTotal = 0
  let contextTokens = 0
  let firstFailure: { error: ConversationError; details: string[]; resetsAt?: number } | null = null

  for (let round = 0; round < limits.modelRoundsPerTurn; round++) {
    const size = callSize(profile.systemPrompt, tools, history, appended, mediaCount, limits.maxOutputTokens)
    const attemptCost = estimateMaxCostUsd(profile.model, { ...size, attempts: 1 })
    const reservation = await deps.budgets.reserve(session.userId, profile, estimateMaxCostUsd(profile.model, size), deps.clock.now())
    if (typeof reservation === 'string') {
      await auditSecurity(deps, session, profile, reservation)
      if (calls === 0) firstFailure = { error: reservation, details: [], resetsAt: resetsAt(reservation as BudgetRefusal, deps.clock.now()) }
      stoppedBy = 'budget'
      break
    }

    let result: ChatResult
    try {
      const chatRequest: ChatRequest = {
        model: profile.model,
        effort: profile.effort,
        system: profile.systemPrompt,
        tools,
        // Last round: the tool list stays the same, but the model must answer in text.
        toolChoice: round === limits.modelRoundsPerTurn - 1 ? 'none' : 'auto',
        messages: [...history.flatMap((turn) => turn.messages), ...appended],
        maxOutputTokens: limits.maxOutputTokens,
        timeoutMs: limits.timeoutMs,
      }
      result = await clients.chat.converse(chatRequest)
      // A request that timed out may still have been billed: count it at its maximum cost.
      let timedOut = result.kind === 'error' && result.cause === 'timeout' ? 1 : 0
      if (result.kind === 'error' && result.retryable) {
        result = await clients.chat.converse(chatRequest)
        if (result.kind === 'error' && result.cause === 'timeout') timedOut += 1
      }
      const usage: CachedUsage =
        result.kind === 'ok' ? result.usage : { inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0 }
      const cost = cachedCostUsd(profile.model, usage) + timedOut * attemptCost
      if (cost > 0) {
        await deps.ledger.insert({ userId: session.userId, profileId: profile.id, at: deps.clock.now(), usage, costUsd: cost })
      }
      costTotal += cost
    } finally {
      reservation.release()
    }

    if (result.kind === 'error' || !resolveAllowedModel(result.model)) {
      const code = result.kind === 'error' ? result.cause : 'model_not_allowed'
      await auditSecurity(deps, session, profile, code)
      if (calls === 0) firstFailure = { error: 'model_unavailable', details: [code] }
      stoppedBy = 'error'
      break
    }
    calls += 1
    contextTokens = result.usage.inputTokens + result.usage.cacheWriteTokens + result.usage.cacheReadTokens

    if (result.stopReason === 'refusal') {
      // A refused answer may be partial: nothing of it is replayed.
      await auditSecurity(deps, session, profile, 'model_refused')
      stoppedBy = 'refusal'
      break
    }
    if (result.stopReason === 'max_tokens') {
      // A cut tool call would have no result: only text and thinking are kept.
      const kept = result.content.filter((block) => block.type !== 'tool_use')
      if (kept.length > 0) appended.push({ role: 'assistant', content: kept })
      stoppedBy = 'truncated'
      break
    }
    if (result.content.length > 0) appended.push({ role: 'assistant', content: result.content })
    if (result.stopReason !== 'tool_use') break

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const block of result.content) {
      if (block.type !== 'tool_use') continue
      const tool = profile.tools.find((t) => t.name === block.name)
      const reply = (content: string, isError: boolean): Anthropic.ToolResultBlockParam => ({
        type: 'tool_result',
        tool_use_id: block.id,
        content: dataTag('resultat_outil', { outil: tool?.name ?? 'inconnu' }, content),
        is_error: isError,
      })
      if (!tool) {
        results.push(reply('Outil inconnu.', true))
        continue
      }
      if (!validatorFor(tool)?.(block.input)) {
        results.push(reply('Arguments invalides.', true))
        continue
      }
      if (tool.writes && writes >= limits.writesPerTurn) {
        results.push(reply('Limite d’écritures atteinte pour ce message.', true))
        continue
      }
      if (tool.writes) writes += 1
      try {
        const outcome = await tool.run(
          { space: deps.space, session, conversation, external, now: deps.clock.now() },
          block.input,
        )
        // Marked before any later write of this round runs (spec 10.3).
        if (outcome.readsExternal) external = true
        for (const effect of outcome.effects ?? []) {
          if (effect.type === 'done') done.push(effect)
          else pending.push(effect)
        }
        results.push(reply(outcome.content, outcome.isError === true))
      } catch {
        await auditSecurity(deps, session, profile, 'tool_error')
        results.push(reply('Erreur interne de l’outil.', true))
      }
    }
    appended.push({ role: 'user', content: results })
  }

  if (calls === 0) {
    const failure = firstFailure ?? { error: 'model_unavailable' as const, details: [] }
    return fail(failure.error, failure.details, failure.resetsAt)
  }

  // 6. Append-only storage: the turn's messages are replayed unchanged on every later turn.
  const turn: TurnRecord = {
    conversationId: conversation.id,
    index: conversation.turnCount,
    segment: conversation.segment,
    at: deps.clock.now(),
    messages: appended,
    media: mediaCount,
    contextTokens,
  }
  await deps.space.turns.append(turn)
  const next: ConversationRecord = {
    ...conversation,
    turnCount: conversation.turnCount + 1,
    // The first turn of the segment now carries the summary.
    segmentSummary: null,
    external,
    memoriesSent,
    updatedAt: deps.clock.now(),
    version: conversation.version + 1,
  }
  if (!(await deps.space.conversations.compareAndSet(conversation.id, conversation.version, next))) return fail('conflict')

  const lastAssistant = [...appended].reverse().find((m) => m.role === 'assistant' && textOf(m).trim() !== '')
  let reply = stoppedBy === 'refusal' ? REFUSAL_REPLY : stripInvisible(lastAssistant ? textOf(lastAssistant) : '').value.trim()
  if (stoppedBy === 'truncated' || stoppedBy === 'budget' || stoppedBy === 'error') {
    reply = [reply, NOTES[stoppedBy]].filter(Boolean).join('\n\n')
  }

  return {
    ok: true,
    reply,
    stoppedBy,
    done,
    pending,
    costUsd: costTotal,
    budget: await deps.budgets.remaining(session.userId, profile, deps.clock.now()),
    external,
    turnCount: next.turnCount,
    inputSanitized,
  }
}
