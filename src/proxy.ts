import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRequest, contentSecurityPolicy, isBuiltAsset, policyFromEnv } from '@/server/security/request-policy'

const policy = policyFromEnv({ PORT: process.env.PORT, AI_OS_EXTRA_HOSTS: process.env.AI_OS_EXTRA_HOSTS })
const development = process.env.NODE_ENV === 'development'

/**
 * Runs before every request (threat model L1, M1): unknown Host, foreign Origin or a form body
 * on a request that changes something are refused here; pages get a CSP with a fresh nonce.
 * Route handlers still check the session themselves (L2).
 */
export function proxy(request: NextRequest) {
  const refusal = checkRequest(
    {
      method: request.method,
      host: request.headers.get('host'),
      origin: request.headers.get('origin'),
      contentType: request.headers.get('content-type'),
    },
    policy,
  )
  if (refusal) {
    return new NextResponse(refusal.reason, {
      status: refusal.status,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  if (isBuiltAsset(request.nextUrl.pathname)) return NextResponse.next()

  const nonce = btoa(crypto.randomUUID())
  const csp = contentSecurityPolicy(nonce, development)
  // Next reads the CSP from the request headers to put the nonce on its own scripts.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', csp)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('content-security-policy', csp)
  return response
}
