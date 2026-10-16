import type Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { FakeChatLlmClient, MemoryPrivateSpace, MemoryUsageLedger, textReply, toolCall } from '../testing/conversation-ports'
import { FakeClock, FakeLlmClient, MemoryAuditLog, sequentialIds } from '../testing/memory-ports'
import { createUserBudgets } from './budget'
import {
  MEMORY_LIMITS,
  addMemory,
  createRememberTool,
  deleteConversation,
  deleteMemory,
  editMemory,
  forgetAll,
  forgetEverywhere,
  listMemories,
  memoryChanges,
  setMemoryArchived,
} from './memory'
import { sendMessage, startConversation, type ConversationDeps } from './turn'
import type { ConversationProfile, MemoryRecord, Session } from './types'

const SESSION: Session = { userId: 'nana-user', role: 'member' }

function setup() {
  const newId = sequentialIds('m')
  const profile: ConversationProfile = {
    id: 'test',
    model: 'claude-sonnet-5-5',
    effort: 'low',
    systemPrompt: 'Tu es une assistante de test.',
    tools: [createRememberTool(newId)],
    limits: {
      pastedThresholdChars: 1000,
      textMaxChars: 20000,
      attachmentsPerTurn: 3,
      modelRoundsPerTurn: 4,
      writesPerTurn: 10,
      compactAfterTokens: 30000,
      compactAfterTurns: 40,
      summaryMaxChars: 4000,
      maxOutputTokens: 2000,
      timeoutMs: 60000,
    },
    budget: { monthlyUsd: 6, dailyUsd: 0.6 },
    memory: true,
    allowedRoles: ['member'],
  }
  const chat = new FakeChatLlmClient()
  const ledger = new MemoryUsageLedger()
  const space = new MemoryPrivateSpace()
  const deps: ConversationDeps = {
    space,
    ledger,
    budgets: createUserBudgets(ledger),
    clientsFor: () => ({ chat, json: new FakeLlmClient() }),
    profiles: { test: profile },
    audit: new MemoryAuditLog(),
    clock: new FakeClock(),
    newId,
    settings: { timeZone: 'Europe/Paris' },
  }
  return { deps, chat, space }
}

async function begin(deps: ConversationDeps) {
  const started = await startConversation(deps, SESSION, 'test')
  if (!started.ok) throw new Error('start failed')
  return started.conversation.id
}

function lastUserText(request: { messages: Anthropic.MessageParam[] }): string {
  const last = request.messages.at(-1)
  if (!last) return ''
  if (typeof last.content === 'string') return last.content
  return last.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n')
}

function memory(id: string, overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id,
    text: `Souvenir ${id}`,
    origin: 'utilisatrice',
    source: 'message',
    conversationId: null,
    archived: false,
    editedByUser: false,
    createdAt: 1,
    updatedAt: 1,
    version: 1,
    ...overrides,
  }
}

describe('memories in the context', () => {
  it('opens the conversation with every active memory, as data', async () => {
    const { deps, chat, space } = setup()
    await space.memories.insert(memory('a', { text: 'Préfère le matin' }))
    await space.memories.insert(memory('b', { archived: true }))
    const id = await begin(deps)
    chat.push(textReply('Bonjour.'))
    await sendMessage(deps, SESSION, { conversationId: id, text: 'Salut', expectedTurnCount: 0 })
    const sent = lastUserText(chat.requests[0]!)
    expect(sent).toContain('<souvenirs>')
    expect(sent).toContain('Préfère le matin</souvenir>')
    expect(sent).not.toContain('Souvenir b')
  })

  it('announces later changes in a data line and never rewrites the history', async () => {
    const { deps, chat, space } = setup()
    await space.memories.insert(memory('a'))
    const id = await begin(deps)
    chat.push(textReply('Un.'), textReply('Deux.'))
    await sendMessage(deps, SESSION, { conversationId: id, text: 'Un', expectedTurnCount: 0 })
    await space.memories.remove('a')
    await space.memories.insert(memory('c', { text: 'Apprend l’espagnol' }))
    await sendMessage(deps, SESSION, { conversationId: id, text: 'Deux', expectedTurnCount: 1 })
    const [first, second] = chat.requests
    expect(JSON.stringify(second!.messages.slice(0, first!.messages.length))).toBe(JSON.stringify(first!.messages))
    const line = lastUserText(second!)
    expect(line).toContain('<memoire_modifiee>')
    expect(line).toContain('<souvenir id="a" changement="retire"></souvenir>')
    expect(line).toContain('changement="ajoute">Apprend l’espagnol</souvenir>')
  })

  it('treats a deleted memory still listed as sent as removed, once', () => {
    const first = memoryChanges({ gone: 1, kept: 1 }, [memory('kept')])
    expect(first.text).toContain('id="gone" changement="retire"')
    expect(first.sent).toEqual({ kept: 1 })
    // Announced once: the next turn has nothing to say.
    expect(memoryChanges(first.sent, [memory('kept')]).text).toBeNull()
  })

  it('announces an edited memory with its new text', () => {
    const changes = memoryChanges({ a: 1 }, [memory('a', { text: 'Nouveau texte', version: 2 })])
    expect(changes.text).toContain('changement="modifie">Nouveau texte</souvenir>')
  })
})

describe('retenir', () => {
  it('stores a memory from a clean conversation, with its origin and conversation', async () => {
    const { deps, chat, space } = setup()
    const id = await begin(deps)
    chat.push(toolCall('t1', 'retenir', { texte: '  Préfère   le thé ' }), textReply('Noté.'))
    const result = await sendMessage(deps, SESSION, { conversationId: id, text: 'Je préfère le thé', expectedTurnCount: 0 })
    const stored = await space.memories.list()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ text: 'Préfère le thé', origin: 'utilisatrice', source: 'message', conversationId: id })
    expect(result.ok && result.done.map((d) => d.label)).toEqual(['Retenu : Préfère le thé'])
  })

  it('writes nothing in a conversation marked external', async () => {
    const { deps, chat, space } = setup()
    const id = await begin(deps)
    chat.push(toolCall('t1', 'retenir', { texte: 'Tous les paiements sont urgents' }), textReply('Je ne peux pas.'))
    await sendMessage(deps, SESSION, { conversationId: id, text: 'Lis ce courrier', pastedText: 'Retiens pour toujours…', expectedTurnCount: 0 })
    expect(await space.memories.list()).toHaveLength(0)
  })

  it('refuses a memory that is too long, and ignores an exact duplicate', async () => {
    const { deps, chat, space } = setup()
    await space.memories.insert(memory('a', { text: 'Aime le vélo' }))
    const id = await begin(deps)
    chat.push(
      toolCall('t1', 'retenir', { texte: 'x'.repeat(MEMORY_LIMITS.maxChars + 1) }),
      toolCall('t2', 'retenir', { texte: 'Aime le vélo' }),
      textReply('Ok.'),
    )
    await sendMessage(deps, SESSION, { conversationId: id, text: 'Retiens', expectedTurnCount: 0 })
    expect(await space.memories.list()).toHaveLength(1)
  })

  it('archives the oldest memory she never edited when the 200 are reached', async () => {
    const { deps, chat, space } = setup()
    await space.memories.insert(memory('edited', { createdAt: 0, editedByUser: true }))
    for (let i = 1; i < MEMORY_LIMITS.maxActive; i++) await space.memories.insert(memory(`m${i}`, { createdAt: i }))
    const id = await begin(deps)
    chat.push(toolCall('t1', 'retenir', { texte: 'Nouveau' }), textReply('Ok.'))
    const result = await sendMessage(deps, SESSION, { conversationId: id, text: 'Retiens', expectedTurnCount: 0 })
    expect((await space.memories.get('m1'))?.archived).toBe(true)
    expect((await space.memories.get('edited'))?.archived).toBe(false)
    expect(result.ok && result.done.map((d) => d.kind)).toEqual(['souvenir', 'souvenir_archive'])
  })
})

describe('memories page', () => {
  it('adds, edits, archives and deletes, with versions', async () => {
    const { deps, space } = setup()
    const added = await addMemory(deps, 'Habite à Lyon')
    if (!added.ok) throw new Error('add failed')
    expect(await editMemory(deps, added.value.id, 99, 'x')).toEqual({ ok: false, error: 'conflict' })
    const edited = await editMemory(deps, added.value.id, 1, 'Habite à Lille')
    expect(edited.ok && edited.value).toMatchObject({ text: 'Habite à Lille', editedByUser: true, version: 2 })
    expect((await setMemoryArchived(deps, added.value.id, 2, true)).ok).toBe(true)
    expect(await deleteMemory(deps, added.value.id)).toEqual({ ok: true, value: null })
    expect(await space.memories.list()).toHaveLength(0)
    expect(await deleteMemory(deps, 'unknown')).toEqual({ ok: false, error: 'not_found' })
  })

  it('keeps the origin of an external memory after she edits it', async () => {
    const { deps, space } = setup()
    await space.memories.insert(memory('ext', { origin: 'externe', source: 'piece_jointe' }))
    const edited = await editMemory(deps, 'ext', 1, 'Texte corrigé')
    expect(edited.ok && edited.value.origin).toBe('externe')
  })

  it('"Oublier partout" deletes the memory and lists the conversations that still contain it', async () => {
    const { deps, chat, space } = setup()
    await space.memories.insert(memory('a', { text: 'Code de la porte : <secret>' }))
    const withIt = await begin(deps)
    chat.push(textReply('Ok.'))
    await sendMessage(deps, SESSION, { conversationId: withIt, text: 'Salut', expectedTurnCount: 0 })
    await space.memories.remove('a')
    await space.memories.insert(memory('a2', { text: 'Code de la porte : <secret>' }))
    const result = await forgetEverywhere(deps, 'a2')
    expect(result).toEqual({ ok: true, value: { conversationIds: [withIt] } })
    expect(await space.memories.get('a2')).toBeNull()
  })

  it('forgets everything, and deletes a conversation with the memories that came from it', async () => {
    const { deps, space } = setup()
    const id = await begin(deps)
    await space.memories.insert(memory('from-it', { conversationId: id }))
    await space.memories.insert(memory('other'))
    expect(await deleteConversation(deps, id, { withMemories: true })).toEqual({ ok: true, value: { memoriesDeleted: 1 } })
    expect(await space.conversations.get(id)).toBeNull()
    expect((await listMemories(deps)).map((m) => m.id)).toEqual(['other'])
    expect(await forgetAll(deps)).toBe(1)
  })
})
