import type { LlmClient } from '../ports'
import type { ChatLlmClient } from './types'

/**
 * API key of an account: ANTHROPIC_API_KEY_<ACCOUNT> when it is set, otherwise the default ANTHROPIC_API_KEY.
 * The account name is reduced to [A-Z0-9_] so it cannot reach another variable.
 */
export function apiKeyFor(env: Readonly<Record<string, string | undefined>>, account: string): string | null {
  const suffix = account.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  const own = suffix ? env[`ANTHROPIC_API_KEY_${suffix}`] : undefined
  return own || env.ANTHROPIC_API_KEY || null
}

export interface UserClients {
  chat: ChatLlmClient
  /** Single-shot JSON calls, used for summaries. */
  json: LlmClient
}

/** Builds each user's clients once, with that user's key. No client is ever shared between two users. */
export function createUserClients(
  keyFor: (userId: string) => string | null,
  factory: (apiKey: string) => UserClients,
): (userId: string) => UserClients | null {
  const clients = new Map<string, UserClients>()
  return (userId) => {
    const existing = clients.get(userId)
    if (existing) return existing
    const key = keyFor(userId)
    if (!key) return null
    const created = factory(key)
    clients.set(userId, created)
    return created
  }
}
