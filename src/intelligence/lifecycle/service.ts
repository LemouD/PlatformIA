import type { AgentAvailability } from '@/domain/types'
import { computeRiskLevel } from '../definitions/risk'
import type { AgentDefinition, ConfiguredAgent, Lifecycle } from '../definitions/types'
import { validateDraft } from '../definitions/validate'
import type { AgentStore, AuditLog, Clock, ExecutionStore } from '../ports'
import type { AuditActor } from '../records'
import { canTransition } from './transitions'

export interface LifecycleDeps {
  agents: AgentStore
  executions: ExecutionStore
  audit: AuditLog
  clock: Clock
  newId: () => string
}

export type LifecycleError =
  | 'not_found'
  | 'not_configured'
  | 'version_conflict'
  | 'transition_forbidden'
  | 'test_required'
  | 'invalid_draft'

export type LifecycleResult<T> = { ok: true; value: T } | { ok: false; error: LifecycleError; details?: string[] }

function fail<T>(error: LifecycleError, details?: string[]): LifecycleResult<T> {
  return details ? { ok: false, error, details } : { ok: false, error }
}

export async function appendAudit(
  deps: Pick<LifecycleDeps, 'audit' | 'clock' | 'newId'>,
  actor: AuditActor,
  action: string,
  agentId: string | null,
  details: Record<string, string | number | boolean> = {},
): Promise<void> {
  await deps.audit.append({ id: deps.newId(), at: deps.clock.now(), actor, action, agentId, details })
}

async function load(deps: LifecycleDeps, id: string, expectedVersion: number): Promise<LifecycleResult<AgentDefinition>> {
  const current = await deps.agents.get(id)
  if (!current) return fail('not_found')
  if (current.version !== expectedVersion) return fail('version_conflict')
  return { ok: true, value: current }
}

async function write(
  deps: LifecycleDeps,
  current: AgentDefinition,
  next: AgentDefinition,
): Promise<LifecycleResult<AgentDefinition>> {
  const written = await deps.agents.compareAndSet(
    current.id,
    { version: current.version, lifecycle: current.lifecycle },
    next,
  )
  return written ? { ok: true, value: next } : fail('version_conflict')
}

export async function createConfiguredAgent(
  deps: LifecycleDeps,
  input: unknown,
  actor: AuditActor = 'user',
): Promise<LifecycleResult<ConfiguredAgent>> {
  const validation = validateDraft(input)
  if (!validation.ok) return fail('invalid_draft', validation.errors)
  const now = deps.clock.now()
  const agent: ConfiguredAgent = {
    ...validation.draft,
    id: deps.newId(),
    family: 'configured',
    kind: 'on_demand',
    riskLevel: computeRiskLevel(validation.draft.tools),
    lifecycle: 'draft',
    availability: 'online',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
  await deps.agents.insert(agent)
  await deps.agents.appendHistory({ agentId: agent.id, version: 1, snapshot: agent, at: now, reason: 'création' })
  await appendAudit(deps, actor, 'agent_created', agent.id, { version: 1 })
  return { ok: true, value: agent }
}

export async function updateConfiguredAgent(
  deps: LifecycleDeps,
  id: string,
  expectedVersion: number,
  input: unknown,
  reason: string,
): Promise<LifecycleResult<ConfiguredAgent>> {
  const loaded = await load(deps, id, expectedVersion)
  if (!loaded.ok) return fail(loaded.error)
  const current = loaded.value
  if (current.family !== 'configured') return fail('not_configured')
  const validation = validateDraft(input)
  if (!validation.ok) return fail('invalid_draft', validation.errors)
  const now = deps.clock.now()
  const next: ConfiguredAgent = {
    ...current,
    ...validation.draft,
    riskLevel: computeRiskLevel(validation.draft.tools),
    version: current.version + 1,
    lifecycle: current.lifecycle === 'active' ? 'test' : current.lifecycle,
    updatedAt: now,
  }
  const written = await write(deps, current, next)
  if (!written.ok) return fail(written.error)
  await deps.agents.appendHistory({ agentId: id, version: next.version, snapshot: next, at: now, reason })
  await appendAudit(deps, 'user', 'agent_updated', id, { version: next.version, lifecycle: next.lifecycle })
  return { ok: true, value: next }
}

export async function transitionAgent(
  deps: LifecycleDeps,
  id: string,
  expectedVersion: number,
  to: Lifecycle,
): Promise<LifecycleResult<AgentDefinition>> {
  const loaded = await load(deps, id, expectedVersion)
  if (!loaded.ok) return fail(loaded.error)
  const current = loaded.value
  const now = deps.clock.now()
  let next: AgentDefinition

  if (current.family === 'external') {
    if ((to !== 'active' && to !== 'disabled') || current.lifecycle === to) {
      await appendAudit(deps, 'user', 'transition_refused', id, { from: current.lifecycle, to })
      return fail('transition_forbidden')
    }
    next = { ...current, lifecycle: to, updatedAt: now }
  } else {
    if (!canTransition(current.lifecycle, to)) {
      await appendAudit(deps, 'user', 'transition_refused', id, { from: current.lifecycle, to })
      return fail('transition_forbidden')
    }
    if (to === 'active' && !(await deps.executions.hasSucceededTest(id, current.version))) {
      return fail('test_required')
    }
    next = { ...current, lifecycle: to, updatedAt: now }
  }

  const written = await write(deps, current, next)
  if (!written.ok) return written
  await appendAudit(deps, 'user', 'lifecycle_changed', id, { from: current.lifecycle, to, version: current.version })
  return written
}

export async function setAvailability(
  deps: LifecycleDeps,
  id: string,
  expectedVersion: number,
  availability: AgentAvailability,
): Promise<LifecycleResult<ConfiguredAgent>> {
  const loaded = await load(deps, id, expectedVersion)
  if (!loaded.ok) return fail(loaded.error)
  const current = loaded.value
  if (current.family !== 'configured') return fail('not_configured')
  const next: ConfiguredAgent = { ...current, availability, updatedAt: deps.clock.now() }
  const written = await write(deps, current, next)
  if (!written.ok) return fail(written.error)
  await appendAudit(deps, 'user', 'availability_changed', id, { availability })
  return { ok: true, value: next }
}

export async function deleteAgent(
  deps: LifecycleDeps,
  id: string,
  expectedVersion: number,
): Promise<LifecycleResult<null>> {
  const loaded = await load(deps, id, expectedVersion)
  if (!loaded.ok) return fail(loaded.error)
  await deps.agents.remove(id)
  await appendAudit(deps, 'user', 'agent_deleted', id, { version: expectedVersion, family: loaded.value.family })
  return { ok: true, value: null }
}
