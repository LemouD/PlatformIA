import type Anthropic from '@anthropic-ai/sdk'
import type { AllowedModel, Effort, JsonSchema } from '../definitions/types'
import type { CachedUsage } from '../limits/pricing'
import type { LlmErrorCause } from '../ports'

export type Role = 'admin' | 'member'

/**
 * Always built by the route from the session cookie, never from a parameter, the request body or the model.
 * Convention: functions that call the model, spend or audit (startConversation, sendMessage) take the session;
 * functions that only read or write her space take deps alone, since `space` is already bound to the session's user.
 */
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

/** Fields shared by every record of the private space below. */
export interface StoredRecord {
  id: string
  origin: Origin
  createdAt: number
  updatedAt: number
  version: number
}

export interface RecordRepo<T extends StoredRecord> {
  list(): Promise<T[]>
  get(id: string): Promise<T | null>
  insert(record: T): Promise<void>
  /** Writes `next` only if the stored record still has `expectedVersion` (atomic in the store). */
  compareAndSet(id: string, expectedVersion: number, next: T): Promise<boolean>
  /** Real deletion of the encrypted record. */
  remove(id: string): Promise<void>
}

export interface MemoryRecord extends StoredRecord {
  text: string
  /** `contenu_externe`: written in a conversation marked external by an earlier turn or by a record it read. */
  source: 'message' | 'piece_jointe' | 'texte_colle' | 'contenu_externe'
  /** Conversation it came from; null when she wrote it on the memories page. */
  conversationId: string | null
  /** Archived memories stay on her page and are no longer sent to the model. */
  archived: boolean
  editedByUser: boolean
}

export type MemoryRepo = RecordRepo<MemoryRecord>

export interface ListRecord extends StoredRecord {
  name: string
  kind: 'courses' | 'idees' | 'autre'
}

export interface ListItemRecord extends StoredRecord {
  listId: string
  text: string
  done: boolean
}

/** Local dates without time zone (one household): '2026-10-20' or '2026-10-20T09:30'. */
export interface EventRecord extends StoredRecord {
  title: string
  start: string
  end: string | null
  allDay: boolean
  notes: string
}

export interface NoteRecord extends StoredRecord {
  title: string
  text: string
  subject: string | null
}

/** Nothing is ever sent: she copies the draft into her own mail. */
export interface DraftRecord extends StoredRecord {
  subject: string
  body: string
  recipient: string | null
}

/** Shown when she opens the application, once `dueAt` has passed. No push notification. */
export interface ReminderRecord extends StoredRecord {
  /** Epoch computed in her time zone, not the server's. */
  dueAt: number
  text: string
  eventId: string | null
  seen: boolean
}

export type RepoName = 'lists' | 'listItems' | 'events' | 'notes' | 'drafts' | 'reminders' | 'memories'

export interface RecordRef {
  repo: RepoName
  id: string
  version: number
}

/** A write waiting for her Oui. `origin` is the origin the written content will get. */
export interface PendingActionRecord extends StoredRecord {
  conversationId: string
  tool: string
  /** Validated when planned, and again against the tool's current schema at her Oui. */
  args: unknown
  targetRepo: RepoName | null
  targetId: string | null
  targetVersion: number | null
  preview: string
  /** Provenance of the external content when it was planned, given to a memory written at her Oui. */
  externalSource: 'piece_jointe' | 'texte_colle' | 'contenu_externe' | null
  expiresAt: number
  status: 'pending' | 'done' | 'refused' | 'expired' | 'failed'
  /** True once the decision has been announced to the model on the next turn. */
  reported: boolean
}

/** What an Annuler button removes, if nothing was modified since. */
export interface UndoRecord extends StoredRecord {
  conversationId: string
  kind: string
  created: RecordRef[]
  expiresAt: number
  undone: boolean
}

/** One user's private space, already bound to the session. Unknown or foreign ids return null. */
export interface PrivateSpace {
  conversations: ConversationRepo
  turns: TurnRepo
  memories: MemoryRepo
  lists: RecordRepo<ListRecord>
  listItems: RecordRepo<ListItemRecord>
  events: RecordRepo<EventRecord>
  notes: RecordRepo<NoteRecord>
  drafts: RecordRepo<DraftRecord>
  reminders: RecordRepo<ReminderRecord>
  pending: RecordRepo<PendingActionRecord>
  undo: RecordRepo<UndoRecord>
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
  conversationId: string
  /** True when the conversation is marked external: every write must then wait for her confirmation. */
  external: boolean
  /** Provenance given to a memory written in an external conversation. */
  externalSource: 'piece_jointe' | 'texte_colle' | 'contenu_externe'
  now: number
  newId: () => string
  timeZone: string
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
}

/** A write the code has checked and described, before it runs (now, or at her Oui). */
export interface PlannedWrite {
  /** Shown to her, built by the code from validated arguments. */
  preview: string
  /** The record a change or deletion targets, with the version seen when planning. */
  target: RecordRef | null
}

export interface AppliedWrite {
  /** Records created, for the Annuler button. Empty for a change or a deletion. */
  created: RecordRef[]
  label: string
  /** Side effects worth showing, such as a memory archived to make room. */
  notes?: string[]
}

/**
 * `read` runs at once. `add` runs at once with an Annuler button, or waits for her Oui in an external conversation.
 * `change` (modification or deletion) always waits for her Oui. In every case `args` has already passed `inputSchema`.
 */
export type ConversationTool =
  | {
      name: string
      description: string
      inputSchema: JsonSchema
      kind: 'read'
      run(ctx: ToolContext, args: unknown): Promise<ToolOutcome>
    }
  | {
      name: string
      description: string
      inputSchema: JsonSchema
      kind: 'add' | 'change'
      /** Checks sizes, limits and ownership; an error is sent back to the model. */
      plan(ctx: ToolContext, args: unknown): Promise<PlannedWrite | { error: string }>
      /** Runs the write. `origin` is 'externe' when it was planned in an external conversation. */
      apply(ctx: ToolContext, args: unknown, origin: Origin): Promise<AppliedWrite | { error: string }>
    }
