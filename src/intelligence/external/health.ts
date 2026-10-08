import type { ExternalAgent } from '../definitions/types'

/** For homelab-guard, silence is the most important alert: cutting monitoring is an attacker's first move. */
export function getExternalAgentHealth(agent: ExternalAgent, now: number): 'ok' | 'silent' | 'disabled' {
  if (agent.lifecycle === 'disabled') return 'disabled'
  const reference = agent.lastSeenAt ?? agent.createdAt
  return now - reference > agent.silenceAfterMinutes * 60_000 ? 'silent' : 'ok'
}
