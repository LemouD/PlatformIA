import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

/** Token format: `<agentId>.<secret>`. Only the SHA-256 of the secret is ever stored. */
export function issueToken(agentId: string): { token: string; tokenHash: string } {
  const secret = randomBytes(32).toString('base64url')
  return { token: `${agentId}.${secret}`, tokenHash: sha256(secret) }
}

export function verifyToken(raw: string): { agentId: string; secretHash: string } | null {
  const dot = raw.indexOf('.')
  if (dot <= 0 || dot === raw.length - 1 || raw.length > 200) return null
  return { agentId: raw.slice(0, dot), secretHash: sha256(raw.slice(dot + 1)) }
}

export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}
