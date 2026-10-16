import { compileOutputSchema } from '../definitions/compile-schema'
import { dataTag } from './context'
import type {
  ConversationProfile,
  ConversationTool,
  PendingActionRecord,
  PrivateSpace,
  RecordRef,
  ToolContext,
  ToolEffect,
  UndoRecord,
} from './types'

export const PENDING_TTL_MS = 24 * 60 * 60 * 1000
export const UNDO_TTL_MS = 24 * 60 * 60 * 1000
/** Seen reminders older than this, and expired actions never reported, are deleted for good. */
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000

type WriteTool = Extract<ConversationTool, { kind: 'add' | 'change' }>

export interface WriteOutcome {
  content: string
  isError: boolean
  effects: ToolEffect[]
}

const repoOf = (space: PrivateSpace, ref: Pick<RecordRef, 'repo'>) => space[ref.repo]

/**
 * A write asked by the model. `add` runs at once with an Annuler button, unless the conversation is external;
 * `change` always waits for her Oui (spec section 10).
 */
export async function handleWrite(tool: WriteTool, ctx: ToolContext, args: unknown): Promise<WriteOutcome> {
  const planned = await tool.plan(ctx, args)
  if ('error' in planned) return { content: planned.error, isError: true, effects: [] }

  if (tool.kind === 'change' || ctx.external) {
    const pending: PendingActionRecord = {
      id: ctx.newId(),
      origin: ctx.external ? 'externe' : 'utilisatrice',
      createdAt: ctx.now,
      updatedAt: ctx.now,
      version: 1,
      conversationId: ctx.conversationId,
      tool: tool.name,
      args,
      targetRepo: planned.target?.repo ?? null,
      targetId: planned.target?.id ?? null,
      targetVersion: planned.target?.version ?? null,
      preview: planned.preview,
      externalSource: ctx.external ? ctx.externalSource : null,
      expiresAt: ctx.now + PENDING_TTL_MS,
      status: 'pending',
      reported: false,
    }
    await ctx.space.pending.insert(pending)
    return {
      content: 'En attente de la confirmation de l’utilisatrice : rien n’est fait tant qu’elle n’a pas répondu Oui.',
      isError: false,
      effects: [{ type: 'pending', pendingId: pending.id, kind: tool.name, preview: planned.preview }],
    }
  }

  const applied = await tool.apply(ctx, args, 'utilisatrice')
  if ('error' in applied) return { content: applied.error, isError: true, effects: [] }
  const effects: ToolEffect[] = []
  if (applied.created.length > 0) {
    const undo: UndoRecord = {
      id: ctx.newId(),
      origin: 'utilisatrice',
      createdAt: ctx.now,
      updatedAt: ctx.now,
      version: 1,
      conversationId: ctx.conversationId,
      kind: tool.name,
      created: applied.created,
      expiresAt: ctx.now + UNDO_TTL_MS,
      undone: false,
    }
    await ctx.space.undo.insert(undo)
    effects.push({ type: 'done', actionId: undo.id, kind: tool.name, undoable: true, label: applied.label })
  } else {
    effects.push({ type: 'done', actionId: ctx.newId(), kind: tool.name, undoable: false, label: applied.label })
  }
  for (const note of applied.notes ?? []) effects.push({ type: 'done', actionId: ctx.newId(), kind: `${tool.name}_note`, undoable: false, label: note })
  return { content: `Fait : ${applied.label}`, isError: false, effects }
}

export interface PendingDeps {
  space: PrivateSpace
  profiles: Readonly<Record<string, ConversationProfile>>
  clock: { now(): number }
  newId: () => string
  settings: { timeZone: string }
}

export type ResolveResult =
  | { ok: true; status: 'done' | 'refused'; label: string | null }
  | { ok: false; error: 'not_found' | 'already_decided' | 'expired' | 'failed'; reason?: string }

async function setStatus(space: PrivateSpace, pending: PendingActionRecord, status: PendingActionRecord['status'], now: number) {
  await space.pending.compareAndSet(pending.id, pending.version, { ...pending, status, updatedAt: now, version: pending.version + 1 })
}

/**
 * Her answer to a pending write, from the interface only: no tool lets the model confirm.
 * At her Oui, the arguments are validated again against the tool's current schema, the target must still be
 * in her space with the version seen when planning, and the plan runs again before the write.
 */
export async function resolvePending(
  deps: PendingDeps,
  request: { pendingId: string; decision: 'oui' | 'non' },
): Promise<ResolveResult> {
  const now = deps.clock.now()
  const pending = await deps.space.pending.get(request.pendingId)
  if (!pending) return { ok: false, error: 'not_found' }
  if (pending.status !== 'pending') return { ok: false, error: 'already_decided' }
  if (pending.expiresAt <= now) {
    await setStatus(deps.space, pending, 'expired', now)
    return { ok: false, error: 'expired' }
  }
  if (request.decision === 'non') {
    await setStatus(deps.space, pending, 'refused', now)
    return { ok: true, status: 'refused', label: null }
  }

  const failed = async (reason: string): Promise<ResolveResult> => {
    await setStatus(deps.space, pending, 'failed', now)
    return { ok: false, error: 'failed', reason }
  }
  const conversation = await deps.space.conversations.get(pending.conversationId)
  const profile = conversation && Object.hasOwn(deps.profiles, conversation.profileId) ? deps.profiles[conversation.profileId] : undefined
  const tool = profile?.tools.find((t): t is WriteTool => t.name === pending.tool && t.kind !== 'read')
  if (!conversation || !tool) return failed('tool_unavailable')
  if (!compileOutputSchema(tool.inputSchema)?.(pending.args)) return failed('arguments_invalid')
  if (pending.targetRepo && pending.targetId) {
    const target = await repoOf(deps.space, { repo: pending.targetRepo }).get(pending.targetId)
    if (!target || target.version !== pending.targetVersion) return failed('target_changed')
  }
  const ctx: ToolContext = {
    space: deps.space,
    conversationId: conversation.id,
    external: pending.origin === 'externe',
    externalSource: pending.externalSource ?? 'contenu_externe',
    now,
    newId: deps.newId,
    timeZone: deps.settings.timeZone,
  }
  const planned = await tool.plan(ctx, pending.args)
  if ('error' in planned) return failed('plan_refused')
  const applied = await tool.apply(ctx, pending.args, pending.origin)
  if ('error' in applied) return failed('apply_refused')
  await setStatus(deps.space, pending, 'done', now)
  return { ok: true, status: 'done', label: applied.label }
}

export type UndoResult = { ok: true } | { ok: false; error: 'not_found' | 'expired' | 'modified' }

/** The Annuler button: removes what an action created, only if none of it changed since. */
export async function undoAction(deps: Pick<PendingDeps, 'space' | 'clock'>, request: { actionId: string }): Promise<UndoResult> {
  const now = deps.clock.now()
  const undo = await deps.space.undo.get(request.actionId)
  if (!undo || undo.undone) return { ok: false, error: 'not_found' }
  if (undo.expiresAt <= now) return { ok: false, error: 'expired' }
  for (const ref of undo.created) {
    const current = await repoOf(deps.space, ref).get(ref.id)
    if (current && current.version !== ref.version) return { ok: false, error: 'modified' }
  }
  for (const ref of undo.created) await repoOf(deps.space, ref).remove(ref.id)
  await deps.space.undo.compareAndSet(undo.id, undo.version, { ...undo, undone: true, updatedAt: now, version: undo.version + 1 })
  return { ok: true }
}

const DECISIONS: Record<PendingActionRecord['status'], string> = {
  pending: 'en_attente',
  done: 'oui',
  refused: 'non',
  expired: 'expiree',
  failed: 'echec',
}

/** Decisions not yet announced to the model in this conversation, as data lines for the next turn. */
export async function unreportedDecisions(
  space: PrivateSpace,
  conversationId: string,
  now: number,
): Promise<{ lines: string[]; records: PendingActionRecord[] }> {
  const records = (await space.pending.list()).filter(
    (p) => p.conversationId === conversationId && !p.reported && (p.status !== 'pending' || p.expiresAt <= now),
  )
  const lines = records.map((p) =>
    dataTag('action_confirmee', { outil: p.tool, decision: DECISIONS[p.status === 'pending' ? 'expired' : p.status] }, p.preview),
  )
  return { lines, records }
}

export async function markReported(space: PrivateSpace, records: PendingActionRecord[], now: number): Promise<void> {
  for (const p of records) {
    const status = p.status === 'pending' ? 'expired' : p.status
    await space.pending.compareAndSet(p.id, p.version, { ...p, status, reported: true, updatedAt: now, version: p.version + 1 })
  }
}

/**
 * Real deletion of what is no longer needed. The server calls it when a session opens, and from time to time.
 * - decided actions already announced to the model;
 * - actions expired more than 30 days ago (the conversation was never resumed);
 * - Annuler records that were used or expired;
 * - reminders seen more than 30 days after their time.
 */
export async function purgeExpired(space: PrivateSpace, now: number): Promise<{ pending: number; undo: number; reminders: number }> {
  let pending = 0
  for (const p of await space.pending.list()) {
    const decidedAndReported = p.status !== 'pending' && p.reported
    const abandoned = p.expiresAt + RETENTION_MS <= now
    if (decidedAndReported || abandoned) {
      await space.pending.remove(p.id)
      pending += 1
    }
  }
  let undo = 0
  for (const u of await space.undo.list()) {
    if (u.undone || u.expiresAt <= now) {
      await space.undo.remove(u.id)
      undo += 1
    }
  }
  let reminders = 0
  for (const r of await space.reminders.list()) {
    if (r.seen && r.dueAt + RETENTION_MS <= now) {
      await space.reminders.remove(r.id)
      reminders += 1
    }
  }
  return { pending, undo, reminders }
}
