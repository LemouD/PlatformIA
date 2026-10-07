import { beforeEach, describe, expect, it } from 'vitest'
import { transitionAgent } from '../lifecycle/service'
import {
  FakeClock,
  MemoryAgentStore,
  MemoryAuditLog,
  MemoryExecutionStore,
  MemoryReportStore,
  sequentialIds,
} from '../testing/memory-ports'
import { createExternalGateway } from './gateway'
import { getExternalAgentHealth } from './health'
import { registerExternalAgent, rotateExternalToken, type ExternalDeps } from './register'

let deps: ExternalDeps
let clock: FakeClock
let reports: MemoryReportStore
let audit: MemoryAuditLog

const GUARD = { name: 'homelab-guard', objective: 'Surveiller le réseau domestique.', environment: 'home', silenceAfterMinutes: 30 }
const REPORT = { severity: 'high', summary: 'Nouvel appareil inconnu', details: { mac: 'aa:bb:cc:dd:ee:ff' } }

beforeEach(() => {
  clock = new FakeClock()
  reports = new MemoryReportStore()
  audit = new MemoryAuditLog()
  deps = {
    agents: new MemoryAgentStore(),
    executions: new MemoryExecutionStore(),
    audit,
    clock,
    newId: sequentialIds(),
    reports,
  }
})

async function registered() {
  const result = await registerExternalAgent(deps, GUARD)
  if (!result.ok) throw new Error('setup')
  return result
}

describe('registerExternalAgent', () => {
  it('returns the token once and stores only its hash', async () => {
    const { agent, token } = await registered()
    const secret = token.split('.')[1] ?? ''
    expect(token.startsWith(`${agent.id}.`)).toBe(true)
    expect(secret.length).toBeGreaterThanOrEqual(43)
    expect(JSON.stringify(agent)).not.toContain(secret)
    expect(agent).toMatchObject({ family: 'external', lifecycle: 'active', lastSeenAt: null })
  })
  it('rejects invisible characters and an out-of-range silence threshold', async () => {
    expect(await registerExternalAgent(deps, { ...GUARD, name: 'guard‮' })).toMatchObject({ ok: false })
    expect(await registerExternalAgent(deps, { ...GUARD, silenceAfterMinutes: 1 })).toMatchObject({ ok: false })
  })
})

describe('gateway', () => {
  it('accepts a valid report, records it and updates the last contact', async () => {
    const { agent, token } = await registered()
    const gateway = createExternalGateway(deps)
    expect(await gateway.receiveReport(token, REPORT, '100.64.0.2')).toEqual({ ok: true })
    expect(reports.reports[0]).toMatchObject({ agentId: agent.id, severity: 'high', sanitized: false })
    const seen = await deps.agents.get(agent.id)
    expect(seen?.family === 'external' && seen.lastSeenAt).toBe(clock.now())
  })
  it('strips invisible characters from a report and marks it', async () => {
    const { token } = await registered()
    await createExternalGateway(deps).receiveReport(token, { ...REPORT, summary: 'Alerte​' }, 's')
    expect(reports.reports[0]).toMatchObject({ summary: 'Alerte', sanitized: true })
  })
  it('refuses an invalid report', async () => {
    const { token } = await registered()
    const gateway = createExternalGateway(deps)
    expect(await gateway.receiveReport(token, { severity: 'apocalypse', summary: 'x', details: {} }, 's')).toEqual({
      ok: false,
      error: 'invalid_report',
    })
    expect(await gateway.receiveReport(token, { ...REPORT, details: { big: 'x'.repeat(20_000) } }, 's')).toEqual({
      ok: false,
      error: 'invalid_report',
    })
  })
  it('refuses unknown, revoked and disabled tokens', async () => {
    const { agent, token } = await registered()
    const gateway = createExternalGateway(deps)
    expect(await gateway.receiveHeartbeat(`${agent.id}.faux`, 's')).toEqual({ ok: false, error: 'unauthorized' })
    const rotated = await rotateExternalToken(deps, agent.id, 1)
    expect(rotated.ok).toBe(true)
    expect(await gateway.receiveHeartbeat(token, 's')).toEqual({ ok: false, error: 'unauthorized' })
    if (!rotated.ok) return
    await transitionAgent(deps, agent.id, rotated.agent.version, 'disabled')
    expect(await gateway.receiveHeartbeat(rotated.token, 's')).toEqual({ ok: false, error: 'unauthorized' })
  })
  it('rate-limits per source before checking the token', async () => {
    const gateway = createExternalGateway(deps, { requestsPerMinute: 3 })
    for (let i = 0; i < 3; i++) await gateway.receiveHeartbeat('x.y', 'attacker')
    expect(await gateway.receiveHeartbeat('x.y', 'attacker')).toEqual({ ok: false, error: 'rate_limited' })
    expect(await gateway.receiveHeartbeat('x.y', 'other')).toEqual({ ok: false, error: 'unauthorized' })
  })
  it('groups token refusals in the audit', async () => {
    const gateway = createExternalGateway(deps, { requestsPerMinute: 1000, auditIntervalMs: 60_000 })
    for (let i = 0; i < 50; i++) await gateway.receiveHeartbeat('x.y', 'attacker')
    clock.advance(61_000)
    await gateway.flushRefusals()
    const lines = audit.entries.filter((e) => e.action.startsWith('token_refused'))
    expect(lines).toHaveLength(2)
    expect(lines[1]?.details).toMatchObject({ source: 'attacker', count: 49 })
  })
})

describe('getExternalAgentHealth', () => {
  it('becomes silent once the threshold has passed since the last contact', async () => {
    const { agent, token } = await registered()
    await createExternalGateway(deps).receiveHeartbeat(token, 's')
    const seen = await deps.agents.get(agent.id)
    if (seen?.family !== 'external') throw new Error('setup')
    expect(getExternalAgentHealth(seen, clock.now() + 29 * 60_000)).toBe('ok')
    expect(getExternalAgentHealth(seen, clock.now() + 31 * 60_000)).toBe('silent')
  })
  it('is silent when never seen after the threshold, and disabled when disabled', async () => {
    const { agent } = await registered()
    expect(getExternalAgentHealth(agent, agent.createdAt + 31 * 60_000)).toBe('silent')
    expect(getExternalAgentHealth({ ...agent, lifecycle: 'disabled' }, agent.createdAt)).toBe('disabled')
  })
})
