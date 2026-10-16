import type Anthropic from '@anthropic-ai/sdk'
import type { AllowedModel, Effort, JsonSchema } from '../definitions/types'
import type { CachedUsage } from '../limits/pricing'
import type { LlmErrorCause } from '../ports'

export type Role = 'admin' | 'member'

/** Always built by the route from the session cookie, never from a parameter or the model. */
export interface Session {
  userId: string
  role: Role
}

/** Where a stored record comes from. `externe`: written by a tool in a conversation marked external. */
export type Origin = 'utilisatrice' | 'externe'

export interface ConversationLimits {
  /** A message above this length counts as pasted text, even without the interface's flag. */
  pastedThresholdChars: number
  textMaxChars: number
  attachmentsPerTurn: number
  modelRoundsPerTurn: number
  writesPerTurn: number
  compactAfterTokens: number
  compactAfterTurns: number
  summaryMaxChars: number
  maxOutputTokens: number
  timeoutMs: number
}

/** A conversational assistant, defined in code. Not an agent fiche: the creator cannot edit it and NOVA never lists it. */
export interface ConversationProfile {
  id: string
  model: AllowedModel
  effort: Effort
  systemPrompt: string
  tools: ConversationTool[]
  limits: ConversationLimits
  budget: { monthlyUsd: number; dailyUsd: number }
  /** Memories are sent to the model at the start of each segment, as data. */
  memory: boolean
  allowedRoles: Role[]
}

// Records: plain at the port, encrypted by the PrivateSpace implementation.

export interface ConversationRecord {
  id: string
  profileId: string
  createdAt: number
  updatedAt: number
  turnCount: number
  /** Incremented by each summary: only the turns of the current segment are sent to the model. */
  segment: number
  /** Summary that opens the current segment, until its first turn stores it. */
  segmentSummary: string | null
  /** Sticky: once external content entered the conversation, every write needs confirmation. */
  external: boolean
  /** Memory id → version already sent to the model in this segment: changes are announced, never rewritten. */
  memoriesSent: Record<string, number>
  version: number
}

export interface TurnRecord {
  conversationId: string
  index: number
  segment: number
  at: number
  /** API messages appended by this turn, replayed byte for byte on every later turn (append-only history). */
  messages: Anthropic.MessageParam[]
  /** Images and PDF pages in `messages`, for the budget estimate of later turns. */
  media: { images: number; pdfPages: number }
  /** Whole input of the turn's last model call, cache included: drives the summary threshold. */
  contextTokens: number
}

export interface ConversationRepo {
  get(id: string): Promise<ConversationRecord | null>
  list(): Promise<ConversationRecord[]>
  insert(record: ConversationRecord): Promise<void>
  /** Writes `next` only if the stored record still has `expectedVersion`. */
  compareAndSet(id: string, expectedVersion: number, next: ConversationRecord): Promise<boolean>
  /** Deletes the conversation and all its turns. */
  remove(id: string): Promise<void>
}

export interface TurnRepo {
  append(turn: TurnRecord): Promise<void>
  listSegment(conversationId: string, segment: number): Promise<TurnRecord[]>
}

export interface MemoryRecord {
  id: string
  text: string
  origin: Origin
  source: 'message' | 'piece_jointe' | 'texte_colle'
  /** Conversation it came from; null when she wrote it on the memories page. */
  conversationId: string | null
  /** Archived memories stay on her page and are no longer sent to the model. */
  archived: boolean
  editedByUser: boolean
  createdAt: number
  updatedAt: number
  version: number
}

export interface MemoryRepo {
  list(): Promise<MemoryRecord[]>
  get(id: string): Promise<MemoryRecord | null>
  insert(record: MemoryRecord): Promise<void>
  compareAndSet(id: string, expectedVersion: number, next: MemoryRecord): Promise<boolean>
  /** Real deletion of the encrypted record. */
  remove(id: string): Promise<void>
}

/** One user's private space, already bound to the session. Unknown or foreign ids return null. */
export interface PrivateSpace {
  conversations: ConversationRepo
  turns: TurnRepo
  memories: MemoryRepo
}

/** Spending per user and profile. No content: tokens, cost, date. */
export interface UsageLedger {
  insert(entry: { userId: string; profileId: string; at: number; usage: CachedUsage; costUsd: number }): Promise<void>
  sumCostSince(userId: string, profileId: string, since: number): Promise<number>
}

// Model client for conversations.

export interface ChatToolSpec {
  name: string
  description: string
  inputSchema: JsonSchema
}

export interface ChatRequest {
  model: AllowedModel
  effort: Effort
  system: string
  tools: ChatToolSpec[]
  /** 'none' keeps the tool list unchanged (a changed list would break the cache and the thinking blocks). */
  toolChoice: 'auto' | 'none'
  messages: Anthropic.MessageParam[]
  maxOutputTokens: number
  timeoutMs: number
}

export type ChatResult =
  | {
      kind: 'ok'
      stopReason: Anthropic.StopReason | null
      content: Anthropic.ContentBlockParam[]
      model: string
      usage: CachedUsage
    }
  | { kind: 'error'; cause: LlmErrorCause; retryable: boolean }

export interface ChatLlmClient {
  converse(request: ChatRequest): Promise<ChatResult>
}

// Tools.

export interface ToolContext {
  space: PrivateSpace
  session: Session
  conversation: ConversationRecord
  /** True when the conversation is marked external: every write must then wait for her confirmation. */
  external: boolean
  now: number
}

export type ToolEffect =
  | { type: 'done'; actionId: string; kind: string; undoable: boolean; label: string }
  | { type: 'pending'; pendingId: string; kind: string; preview: string }

export interface ToolOutcome {
  /** Sent back to the model as data. */
  content: string
  isError?: boolean
  /** The result contains at least one record of external origin: the conversation becomes external. */
  readsExternal?: boolean
  effects?: ToolEffect[]
}

export interface ConversationTool {
  name: string
  description: string
  inputSchema: JsonSchema
  writes: boolean
  /** `args` has already passed `inputSchema`. */
  run(ctx: ToolContext, args: unknown): Promise<ToolOutcome>
}
