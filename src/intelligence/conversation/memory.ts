import { stripInvisible } from '@/domain/sanitize'
import { dataTag, escapeData } from './context'
import type { ConversationDeps } from './turn'
import type { ConversationTool, MemoryRecord, PrivateSpace } from './types'

export const MEMORY_LIMITS = { maxActive: 200, maxChars: 300 } as const

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)

function memoryTag(memory: MemoryRecord, attributes: Record<string, string> = {}): string {
  return dataTag('souvenir', { id: memory.id, origine: memory.origin, date: day(memory.createdAt), ...attributes }, memory.text)
}

export async function activeMemories(space: PrivateSpace): Promise<MemoryRecord[]> {
  return (await space.memories.list()).filter((m) => !m.archived).sort((a, b) => a.createdAt - b.createdAt)
}

/** Opens a segment: every active memory, as data. Returns the versions sent, to announce later changes. */
export function memoryBlock(memories: MemoryRecord[]): { text: string; sent: Record<string, number> } {
  const sent: Record<string, number> = {}
  for (const m of memories) sent[m.id] = m.version
  const body = memories.length > 0 ? memories.map((m) => memoryTag(m)).join('\n') : 'Aucun souvenir.'
  return { text: `<souvenirs>\n${body}\n</souvenirs>`, sent }
}

/**
 * Changes since the memories last sent in this segment, as one data line added to the new message.
 * The history is never rewritten (spec 6.3).
 */
export function memoryChanges(
  sent: Record<string, number>,
  memories: MemoryRecord[],
): { text: string | null; sent: Record<string, number> } {
  const lines: string[] = []
  const next: Record<string, number> = {}
  const active = new Map(memories.map((m) => [m.id, m]))
  for (const m of memories) {
    next[m.id] = m.version
    const previous = Object.hasOwn(sent, m.id) ? sent[m.id] : undefined
    if (previous === undefined) lines.push(memoryTag(m, { changement: 'ajoute' }))
    else if (previous !== m.version) lines.push(memoryTag(m, { changement: 'modifie' }))
  }
  for (const id of Object.keys(sent)) {
    if (!active.has(id)) lines.push(dataTag('souvenir', { id, changement: 'retire' }, ''))
  }
  return { text: lines.length > 0 ? `<memoire_modifiee>\n${lines.join('\n')}\n</memoire_modifiee>` : null, sent: next }
}

type CleanText = { ok: true; text: string } | { ok: false; reason: 'empty' | 'too_long' }

function cleanMemoryText(raw: string): CleanText {
  const text = stripInvisible(raw).value.replace(/\s+/g, ' ').trim()
  if (!text) return { ok: false, reason: 'empty' }
  if ([...text].length > MEMORY_LIMITS.maxChars) return { ok: false, reason: 'too_long' }
  return { ok: true, text }
}

/** Above 200 active memories, the oldest one she never edited is archived. Null when all were edited by her. */
async function makeRoom(space: PrivateSpace, now: number): Promise<MemoryRecord | null | 'room'> {
  const active = await activeMemories(space)
  if (active.length < MEMORY_LIMITS.maxActive) return 'room'
  const oldest = active.find((m) => !m.editedByUser)
  if (!oldest) return null
  const archived = { ...oldest, archived: true, updatedAt: now, version: oldest.version + 1 }
  return (await space.memories.compareAndSet(oldest.id, oldest.version, archived)) ? oldest : null
}

const REMEMBER_SCHEMA = {
  type: 'object',
  properties: { texte: { type: 'string', description: 'Le souvenir, court et durable, 300 caractères au plus.' } },
  required: ['texte'],
  additionalProperties: false,
}

/**
 * `retenir`: the code, not the model, decides what happens to a proposed memory (spec 8.1).
 * In a conversation marked external, nothing is written until the confirmation flow of PR 3 exists.
 */
export function createRememberTool(newId: () => string): ConversationTool {
  return {
    name: 'retenir',
    description:
      'Retient un fait utile et durable sur l’utilisatrice (préférence, situation, objectif). Pas un journal : un souvenir court.',
    inputSchema: REMEMBER_SCHEMA,
    writes: true,
    async run(ctx, args) {
      if (ctx.external) {
        return {
          content: 'Non retenu : cette conversation contient un contenu externe, un souvenir y demande sa confirmation.',
          isError: true,
        }
      }
      const cleaned = cleanMemoryText((args as { texte: string }).texte)
      if (!cleaned.ok) {
        return { content: cleaned.reason === 'empty' ? 'Souvenir vide.' : 'Souvenir trop long (300 caractères au plus).', isError: true }
      }
      const active = await activeMemories(ctx.space)
      if (active.some((m) => m.text === cleaned.text)) return { content: 'Déjà retenu.' }
      const room = await makeRoom(ctx.space, ctx.now)
      if (room === null) return { content: 'Mémoire pleine : elle doit d’abord en supprimer sur sa page.', isError: true }
      const memory: MemoryRecord = {
        id: newId(),
        text: cleaned.text,
        origin: 'utilisatrice',
        source: 'message',
        conversationId: ctx.conversation.id,
        archived: false,
        editedByUser: false,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        version: 1,
      }
      await ctx.space.memories.insert(memory)
      const effects: NonNullable<Awaited<ReturnType<ConversationTool['run']>>['effects']> = [
        { type: 'done', actionId: memory.id, kind: 'souvenir', undoable: true, label: `Retenu : ${memory.text}` },
      ]
      if (room !== 'room') {
        effects.push({ type: 'done', actionId: room.id, kind: 'souvenir_archive', undoable: false, label: `Archivé : ${room.text}` })
      }
      return { content: 'Retenu.', effects }
    },
  }
}

// Functions of the "Ce dont Nana se souvient" page. Called by her through the interface, never by the model.
// No session parameter: `space` is already bound to the session's user.

type PageDeps = Pick<ConversationDeps, 'space' | 'clock' | 'newId'>
export type MemoryPageResult<T> = { ok: true; value: T } | { ok: false; error: 'not_found' | 'conflict' | 'invalid_input' | 'full' }

/** Every memory, archived ones included, newest first. */
export async function listMemories(deps: PageDeps): Promise<MemoryRecord[]> {
  return (await deps.space.memories.list()).sort((a, b) => b.createdAt - a.createdAt)
}

/** A memory she writes herself on her page. */
export async function addMemory(deps: PageDeps, text: string): Promise<MemoryPageResult<MemoryRecord>> {
  const cleaned = cleanMemoryText(text)
  if (!cleaned.ok) return { ok: false, error: 'invalid_input' }
  if ((await activeMemories(deps.space)).length >= MEMORY_LIMITS.maxActive) return { ok: false, error: 'full' }
  const now = deps.clock.now()
  const memory: MemoryRecord = {
    id: deps.newId(),
    text: cleaned.text,
    origin: 'utilisatrice',
    source: 'message',
    conversationId: null,
    archived: false,
    editedByUser: true,
    createdAt: now,
    updatedAt: now,
    version: 1,
  }
  await deps.space.memories.insert(memory)
  return { ok: true, value: memory }
}

async function update(
  deps: PageDeps,
  id: string,
  expectedVersion: number,
  change: (m: MemoryRecord) => MemoryRecord | null,
): Promise<MemoryPageResult<MemoryRecord>> {
  const current = await deps.space.memories.get(id)
  if (!current) return { ok: false, error: 'not_found' }
  if (current.version !== expectedVersion) return { ok: false, error: 'conflict' }
  const changed = change(current)
  if (!changed) return { ok: false, error: 'invalid_input' }
  const next = { ...changed, updatedAt: deps.clock.now(), version: current.version + 1 }
  return (await deps.space.memories.compareAndSet(id, expectedVersion, next)) ? { ok: true, value: next } : { ok: false, error: 'conflict' }
}

export async function editMemory(
  deps: PageDeps,
  id: string,
  expectedVersion: number,
  text: string,
): Promise<MemoryPageResult<MemoryRecord>> {
  const cleaned = cleanMemoryText(text)
  if (!cleaned.ok) return { ok: false, error: 'invalid_input' }
  // The origin stays: a small edit may leave an injected sentence in place.
  return update(deps, id, expectedVersion, (m) => ({ ...m, text: cleaned.text, editedByUser: true }))
}

export async function setMemoryArchived(
  deps: PageDeps,
  id: string,
  expectedVersion: number,
  archived: boolean,
): Promise<MemoryPageResult<MemoryRecord>> {
  if (!archived && (await activeMemories(deps.space)).length >= MEMORY_LIMITS.maxActive) return { ok: false, error: 'full' }
  return update(deps, id, expectedVersion, (m) => ({ ...m, archived }))
}

export async function deleteMemory(deps: PageDeps, id: string): Promise<MemoryPageResult<null>> {
  if (!(await deps.space.memories.get(id))) return { ok: false, error: 'not_found' }
  await deps.space.memories.remove(id)
  return { ok: true, value: null }
}

/** Conversations whose stored history still contains this text, searched in memory during her session (spec 8.4). */
export async function conversationsContaining(space: PrivateSpace, text: string): Promise<string[]> {
  const needle = escapeData(text)
  const found: string[] = []
  for (const conversation of await space.conversations.list()) {
    for (let segment = 0; segment <= conversation.segment; segment++) {
      const turns = await space.turns.listSegment(conversation.id, segment)
      if (turns.some((turn) => JSON.stringify(turn.messages).includes(JSON.stringify(needle).slice(1, -1)))) {
        found.push(conversation.id)
        break
      }
    }
  }
  return found
}

/** "Oublier partout": deletes the memory, then lists the conversations that still contain it, for her to delete. */
export async function forgetEverywhere(
  deps: PageDeps,
  id: string,
): Promise<MemoryPageResult<{ conversationIds: string[] }>> {
  const memory = await deps.space.memories.get(id)
  if (!memory) return { ok: false, error: 'not_found' }
  await deps.space.memories.remove(id)
  return { ok: true, value: { conversationIds: await conversationsContaining(deps.space, memory.text) } }
}

export async function forgetAll(deps: PageDeps): Promise<number> {
  const all = await deps.space.memories.list()
  for (const m of all) await deps.space.memories.remove(m.id)
  return all.length
}

/** Deleting a conversation can also delete the memories that came from it (spec S8). */
export async function deleteConversation(
  deps: PageDeps,
  conversationId: string,
  options: { withMemories: boolean },
): Promise<MemoryPageResult<{ memoriesDeleted: number }>> {
  if (!(await deps.space.conversations.get(conversationId))) return { ok: false, error: 'not_found' }
  let memoriesDeleted = 0
  if (options.withMemories) {
    for (const m of await deps.space.memories.list()) {
      if (m.conversationId !== conversationId) continue
      await deps.space.memories.remove(m.id)
      memoriesDeleted += 1
    }
  }
  await deps.space.conversations.remove(conversationId)
  return { ok: true, value: { memoriesDeleted } }
}
