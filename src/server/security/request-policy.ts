/**
 * Checks every request against the threat model (modele-de-menaces-plateforme.md, L1 and L8):
 * a fixed list of Host headers stops DNS rebinding, a known Origin and a non-form body stop
 * cross-site requests. Pure functions: proxy.ts applies them, tests drive them directly.
 */

export interface RequestPolicy {
  /** Host header values accepted, e.g. "127.0.0.1:3000" or "machine.tailnet.ts.net". */
  hosts: ReadonlySet<string>
  /** Origins accepted on requests that change something, e.g. "https://machine.tailnet.ts.net". */
  origins: ReadonlySet<string>
}

export interface RequestFacts {
  method: string
  host: string | null
  origin: string | null
  contentType: string | null
}

export interface Refusal {
  status: 400 | 403 | 415
  reason: string
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
/** An HTML form from another site cannot send these without a CORS preflight, which we never answer. */
const BODY_TYPES = ['application/json', 'multipart/form-data']
const HOST_NAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/

/**
 * Builds the policy from the environment. The server listens on 127.0.0.1 only; other devices
 * reach it through `tailscale serve`, whose HTTPS names go in AI_OS_EXTRA_HOSTS (comma separated).
 */
export function policyFromEnv(env: { PORT?: string; AI_OS_EXTRA_HOSTS?: string }): RequestPolicy {
  const port = env.PORT && /^\d{1,5}$/.test(env.PORT) ? env.PORT : '3000'
  const local = [`127.0.0.1:${port}`, `localhost:${port}`]
  const extra = (env.AI_OS_EXTRA_HOSTS ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name !== '')
  for (const name of extra) {
    if (!HOST_NAME.test(name)) throw new Error(`AI_OS_EXTRA_HOSTS: "${name}" is not a host name`)
  }
  return {
    hosts: new Set([...local, ...extra]),
    origins: new Set([...local.map((host) => `http://${host}`), ...extra.map((name) => `https://${name}`)]),
  }
}

/** Null when the request may go on, otherwise why it is refused. */
export function checkRequest(request: RequestFacts, policy: RequestPolicy): Refusal | null {
  if (!request.host || !policy.hosts.has(request.host.toLowerCase())) {
    return { status: 403, reason: 'unknown host' }
  }
  if (SAFE_METHODS.has(request.method.toUpperCase())) return null

  if (!request.origin || !policy.origins.has(request.origin.toLowerCase())) {
    return { status: 403, reason: 'missing or foreign origin' }
  }
  const mediaType = (request.contentType ?? '').split(';')[0]!.trim().toLowerCase()
  if (!BODY_TYPES.includes(mediaType)) {
    return { status: 415, reason: 'body must be JSON or multipart' }
  }
  return null
}

/**
 * Content Security Policy for pages, with a fresh nonce per request (M1, L1). Style attributes
 * stay allowed because React renders inline style props; inline style and script elements need
 * the nonce. Development needs 'unsafe-eval' for React's error overlay.
 */
export function contentSecurityPolicy(nonce: string, development: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}
