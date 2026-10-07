import { z } from 'zod'
import { stripInvisible } from '../definitions/invisible'
import type { ExternalAgent } from '../definitions/types'
import { appendAudit } from '../lifecycle/service'
import type { ExternalDeps } from './register'
import { hashesMatch, verifyToken } from './tokens'

export type GatewayResult = { ok: true } | { ok: false; error: 'rate_limited' | 'unauthorized' | 'invalid_report' }

export interface ExternalGateway {
  receiveReport(rawToken: string, payload: unknown, source: string): Promise<GatewayResult>
  receiveHeartbeat(rawToken: string, source: string): Promise<GatewayResult>
  /** Writes the pending grouped refusal lines. Call it periodically and on shutdown. */
  flushRefusals(): Promise<void>
}

const MAX_REPORT_CHARS = 16_000

const reportSchema = z
  .object({
    severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
    summary: z.string().min(1).max(300),
    details: z.record(z.string().max(64), z.string().max(500)).refine((d) => Object.keys(d).length <= 30),
  })
  .strict()

export function createExternalGateway(
  deps: ExternalDeps,
  options: { requestsPerMinute?: number; auditIntervalMs?: number } = {},
): ExternalGateway {
  const perMinute = options.requestsPerMinute ?? 60
  const interval = options.auditIntervalMs ?? 10 * 60_000
  const windows = new Map<string, { start: number; count: number }>()
  const refusals = new Map<string, { since: number; count: number }>()

  function allow(source: string): boolean {
    const now = deps.clock.now()
    const window = windows.get(source)
    if (!window || now - window.start >= 60_000) {
      windows.set(source, { start: now, count: 1 })
      return true
    }
    window.count += 1
    return window.count <= perMinute
  }

  async function writeSummary(source: string, entry: { since: number; count: number }): Promise<void> {
    if (entry.count > 0) {
      await appendAudit(deps, 'gateway', 'token_refused_summary', null, { source, count: entry.count, since: entry.since })
    }
  }

  async function refuse(source: string): Promise<GatewayResult> {
    const now = deps.clock.now()
    const entry = refusals.get(source)
    if (!entry || now - entry.since >= interval) {
      if (entry) await writeSummary(source, entry)
      refusals.set(source, { since: now, count: 0 })
      await appendAudit(deps, 'gateway', 'token_refused', null, { source })
    } else {
      entry.count += 1
    }
    return { ok: false, error: 'unauthorized' }
  }

  async function authenticate(rawToken: string): Promise<ExternalAgent | null> {
    const parsed = verifyToken(rawToken)
    if (!parsed) return null
    const agent = await deps.agents.get(parsed.agentId)
    if (!agent || agent.family !== 'external' || agent.lifecycle !== 'active') return null
    return hashesMatch(parsed.secretHash, agent.tokenHash) ? agent : null
  }

  async function touch(agent: ExternalAgent): Promise<void> {
    const now = deps.clock.now()
    await deps.agents.compareAndSet(agent.id, { version: agent.version, lifecycle: agent.lifecycle }, { ...agent, lastSeenAt: now })
  }

  return {
    async receiveHeartbeat(rawToken, source) {
      if (!allow(source)) return { ok: false, error: 'rate_limited' }
      const agent = await authenticate(rawToken)
      if (!agent) return refuse(source)
      await touch(agent)
      return { ok: true }
    },

    async receiveReport(rawToken, payload, source) {
      if (!allow(source)) return { ok: false, error: 'rate_limited' }
      const agent = await authenticate(rawToken)
      if (!agent) return refuse(source)
      if (JSON.stringify(payload ?? null).length > MAX_REPORT_CHARS) return { ok: false, error: 'invalid_report' }
      const parsed = reportSchema.safeParse(payload)
      if (!parsed.success) return { ok: false, error: 'invalid_report' }

      let sanitized = false
      const clean = (text: string) => {
        const result = stripInvisible(text)
        sanitized ||= result.stripped
        return result.value
      }
      const details = Object.fromEntries(Object.entries(parsed.data.details).map(([k, v]) => [clean(k), clean(v)]))
      await deps.reports.insert({
        id: deps.newId(),
        agentId: agent.id,
        receivedAt: deps.clock.now(),
        severity: parsed.data.severity,
        summary: clean(parsed.data.summary),
        details,
        sanitized,
      })
      await touch(agent)
      return { ok: true }
    },

    async flushRefusals() {
      const now = deps.clock.now()
      for (const [source, entry] of refusals) {
        if (now - entry.since >= interval) {
          await writeSummary(source, entry)
          refusals.delete(source)
        }
      }
    },
  }
}
