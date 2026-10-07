import { z } from 'zod'
import { hasInvisible } from '../definitions/invisible'
import { ENVIRONMENTS, type ExternalAgent } from '../definitions/types'
import { appendAudit, type LifecycleDeps } from '../lifecycle/service'
import { CEILINGS } from '../limits/ceilings'
import type { ExternalReportStore } from '../ports'
import { issueToken } from './tokens'

export type ExternalDeps = LifecycleDeps & { reports: ExternalReportStore }

const registrationSchema = z
  .object({
    name: z.string().min(1).max(CEILINGS.nameMaxChars),
    objective: z.string().min(1).max(CEILINGS.objectiveMaxChars),
    environment: z.enum(ENVIRONMENTS),
    silenceAfterMinutes: z.number().int().min(5).max(7 * 24 * 60),
  })
  .strict()

export async function registerExternalAgent(
  deps: ExternalDeps,
  input: unknown,
): Promise<{ ok: true; agent: ExternalAgent; token: string } | { ok: false; errors: string[] }> {
  const parsed = registrationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
  const { name, objective, environment, silenceAfterMinutes } = parsed.data
  if (hasInvisible(name) || hasInvisible(objective)) return { ok: false, errors: ['caractères invisibles interdits'] }

  const id = deps.newId()
  const { token, tokenHash } = issueToken(id)
  const now = deps.clock.now()
  const agent: ExternalAgent = {
    id,
    family: 'external',
    name,
    objective,
    environment,
    lifecycle: 'active',
    version: 1,
    tokenHash,
    silenceAfterMinutes,
    lastSeenAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await deps.agents.insert(agent)
  await deps.agents.appendHistory({ agentId: id, version: 1, snapshot: agent, at: now, reason: 'référencement' })
  await appendAudit(deps, 'user', 'external_registered', id, {})
  return { ok: true, agent, token }
}

/** Issues a new token; the previous one stops working immediately. */
export async function rotateExternalToken(
  deps: ExternalDeps,
  id: string,
  expectedVersion: number,
): Promise<{ ok: true; agent: ExternalAgent; token: string } | { ok: false; error: 'not_found' | 'version_conflict' }> {
  const current = await deps.agents.get(id)
  if (!current || current.family !== 'external') return { ok: false, error: 'not_found' }
  if (current.version !== expectedVersion) return { ok: false, error: 'version_conflict' }
  const { token, tokenHash } = issueToken(id)
  const next: ExternalAgent = { ...current, tokenHash, version: current.version + 1, updatedAt: deps.clock.now() }
  const written = await deps.agents.compareAndSet(id, { version: current.version, lifecycle: current.lifecycle }, next)
  if (!written) return { ok: false, error: 'version_conflict' }
  await appendAudit(deps, 'user', 'external_token_rotated', id, { version: next.version })
  return { ok: true, agent: next, token }
}
