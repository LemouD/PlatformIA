import type { CachedUsage } from '../limits/pricing'
import type {
  ChatLlmClient,
  ChatRequest,
  ChatResult,
  ConversationRecord,
  ConversationRepo,
  DraftRecord,
  EventRecord,
  ListItemRecord,
  ListRecord,
  MemoryRecord,
  NoteRecord,
  PendingActionRecord,
  RecordRepo,
  ReminderRecord,
  StoredRecord,
  UndoRecord,
  PrivateSpace,
  TurnRecord,
  TurnRepo,
  UsageLedger,
} from '../conversation/types'

// No constructor parameter properties in this file, like memory-ports.ts.

/** Deep copies on every read and write, as a store that serialises its records would. */
const copy = <T>(value: T): T => structuredClone(value)

export class MemoryConversationRepo implements ConversationRepo {
  readonly records = new Map<string, ConversationRecord>()

  async get(id: string): Promise<ConversationRecord | null> {
    const record = this.records.get(id)
    return record ? copy(record) : null
  }
  async list(): Promise<ConversationRecord[]> {
    return [...this.records.values()].map(copy)
  }
  async insert(record: ConversationRecord): Promise<void> {
    if (this.records.has(record.id)) throw new Error(`duplicate conversation ${record.id}`)
    this.records.set(record.id, copy(record))
  }
  async compareAndSet(id: string, expectedVersion: number, next: ConversationRecord): Promise<boolean> {
    const current = this.records.get(id)
    if (!current || current.version !== expectedVersion) return false
    this.records.set(id, copy(next))
    return true
  }
  async remove(id: string): Promise<void> {
    this.records.delete(id)
  }
}

export class MemoryTurnRepo implements TurnRepo {
  readonly turns: TurnRecord[] = []

  async append(turn: TurnRecord): Promise<void> {
    if (this.turns.some((t) => t.conversationId === turn.conversationId && t.index === turn.index)) {
      throw new Error('turns are append-only')
    }
    this.turns.push(copy(turn))
  }
  async listSegment(conversationId: string, segment: number): Promise<TurnRecord[]> {
    return this.turns
      .filter((t) => t.conversationId === conversationId && t.segment === segment)
      .sort((a, b) => a.index - b.index)
      .map(copy)
  }
}

/** Generic record store with an atomic compareAndSet, like the SQLite tables of the server. */
export class MemoryRecordRepo<T extends StoredRecord> implements RecordRepo<T> {
  readonly records = new Map<string, T>()

  async list(): Promise<T[]> {
    return [...this.records.values()].map(copy)
  }
  async get(id: string): Promise<T | null> {
    const record = this.records.get(id)
    return record ? copy(record) : null
  }
  async insert(record: T): Promise<void> {
    if (this.records.has(record.id)) throw new Error(`duplicate record ${record.id}`)
    this.records.set(record.id, copy(record))
  }
  async compareAndSet(id: string, expectedVersion: number, next: T): Promise<boolean> {
    const current = this.records.get(id)
    if (!current || current.version !== expectedVersion) return false
    this.records.set(id, copy(next))
    return true
  }
  async remove(id: string): Promise<void> {
    this.records.delete(id)
  }
}

/** One user's space. Tests give each user their own instance, as the session binding does. */
export class MemoryPrivateSpace implements PrivateSpace {
  readonly conversations = new MemoryConversationRepo()
  readonly turns = new MemoryTurnRepo()
  readonly memories = new MemoryRecordRepo<MemoryRecord>()
  readonly lists = new MemoryRecordRepo<ListRecord>()
  readonly listItems = new MemoryRecordRepo<ListItemRecord>()
  readonly events = new MemoryRecordRepo<EventRecord>()
  readonly notes = new MemoryRecordRepo<NoteRecord>()
  readonly drafts = new MemoryRecordRepo<DraftRecord>()
  readonly reminders = new MemoryRecordRepo<ReminderRecord>()
  readonly pending = new MemoryRecordRepo<PendingActionRecord>()
  readonly undo = new MemoryRecordRepo<UndoRecord>()
}

export class MemoryUsageLedger implements UsageLedger {
  readonly entries: { userId: string; profileId: string; at: number; usage: CachedUsage; costUsd: number }[] = []

  async insert(entry: { userId: string; profileId: string; at: number; usage: CachedUsage; costUsd: number }): Promise<void> {
    this.entries.push(entry)
  }
  async sumCostSince(userId: string, profileId: string, since: number): Promise<number> {
    return this.entries
      .filter((e) => e.userId === userId && e.profileId === profileId && e.at >= since)
      .reduce((sum, e) => sum + e.costUsd, 0)
  }
}

/** Returns queued results in order and records a copy of every request. */
export class FakeChatLlmClient implements ChatLlmClient {
  readonly requests: ChatRequest[] = []
  private readonly queue: ChatResult[]
  constructor(queue: ChatResult[] = []) {
    this.queue = queue
  }

  push(...results: ChatResult[]): void {
    this.queue.push(...results)
  }

  async converse(request: ChatRequest): Promise<ChatResult> {
    this.requests.push(copy(request))
    const next = this.queue.shift()
    if (!next) throw new Error('FakeChatLlmClient: no queued result')
    return copy(next)
  }
}

export const usageOf = (inputTokens: number, outputTokens: number, cacheReadTokens = 0): CachedUsage => ({
  inputTokens,
  cacheWriteTokens: 0,
  cacheReadTokens,
  outputTokens,
})

/** A plain text answer from the model. */
export function textReply(text: string, usage: CachedUsage = usageOf(1000, 100)): ChatResult {
  return {
    kind: 'ok',
    stopReason: 'end_turn',
    content: [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text },
    ],
    model: 'claude-sonnet-5-5',
    usage,
  }
}

/** The model asks for one tool call. */
export function toolCall(id: string, name: string, input: unknown, usage: CachedUsage = usageOf(1000, 50)): ChatResult {
  return {
    kind: 'ok',
    stopReason: 'tool_use',
    content: [{ type: 'tool_use', id, name, input }],
    model: 'claude-sonnet-5-5',
    usage,
  }
}
