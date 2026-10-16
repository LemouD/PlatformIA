import { describe, expect, it } from 'vitest'
import { checkRequest, contentSecurityPolicy, policyFromEnv } from './request-policy'

const policy = policyFromEnv({ PORT: '3000', AI_OS_EXTRA_HOSTS: 'pc-maison.tail1234.ts.net' })
const post = (overrides: Partial<Parameters<typeof checkRequest>[0]> = {}) =>
  checkRequest(
    {
      method: 'POST',
      host: '127.0.0.1:3000',
      origin: 'http://127.0.0.1:3000',
      contentType: 'application/json',
      ...overrides,
    },
    policy,
  )

describe('policy from the environment', () => {
  it('accepts the loopback names and the Tailscale names, each with its own scheme', () => {
    expect([...policy.hosts]).toEqual(['127.0.0.1:3000', 'localhost:3000', 'pc-maison.tail1234.ts.net'])
    expect(policy.origins.has('https://pc-maison.tail1234.ts.net')).toBe(true)
    expect(policy.origins.has('http://pc-maison.tail1234.ts.net')).toBe(false)
  })

  it('refuses a malformed extra host and falls back to port 3000', () => {
    expect(() => policyFromEnv({ AI_OS_EXTRA_HOSTS: 'evil.com/path' })).toThrow('not a host name')
    expect(policyFromEnv({ PORT: 'abc' }).hosts.has('127.0.0.1:3000')).toBe(true)
  })
})

describe('host check (DNS rebinding)', () => {
  it('refuses any Host outside the list, on every method', () => {
    expect(checkRequest({ method: 'GET', host: 'attacker.example:3000', origin: null, contentType: null }, policy)).toEqual({
      status: 403,
      reason: 'unknown host',
    })
    expect(checkRequest({ method: 'GET', host: null, origin: null, contentType: null }, policy)?.status).toBe(403)
    expect(post({ host: '192.168.1.20:3000' })?.status).toBe(403)
  })

  it('lets reads through from the known names', () => {
    expect(checkRequest({ method: 'GET', host: 'localhost:3000', origin: null, contentType: null }, policy)).toBeNull()
    expect(checkRequest({ method: 'HEAD', host: 'PC-MAISON.tail1234.ts.net', origin: null, contentType: null }, policy)).toBeNull()
  })
})

describe('requests that change something (cross-site)', () => {
  it('need a known Origin', () => {
    expect(post({ origin: null })?.reason).toBe('missing or foreign origin')
    expect(post({ origin: 'null' })?.status).toBe(403)
    expect(post({ origin: 'https://attacker.example' })?.status).toBe(403)
    expect(post({ host: 'pc-maison.tail1234.ts.net', origin: 'https://pc-maison.tail1234.ts.net' })).toBeNull()
  })

  it('need a JSON or multipart body, which an HTML form cannot send', () => {
    expect(post({ contentType: 'application/x-www-form-urlencoded' })?.status).toBe(415)
    expect(post({ contentType: 'text/plain' })?.status).toBe(415)
    expect(post({ contentType: null })?.status).toBe(415)
    expect(post({ contentType: 'application/json; charset=utf-8' })).toBeNull()
    expect(post({ method: 'DELETE', contentType: 'multipart/form-data; boundary=x' })).toBeNull()
  })
})

describe('content security policy', () => {
  it('forbids framing and allows scripts only with the nonce', () => {
    const csp = contentSecurityPolicy('abc123', false)
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'")
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).not.toContain('upgrade-insecure-requests')
    expect(contentSecurityPolicy('abc123', true)).toContain("'unsafe-eval'")
  })
})
