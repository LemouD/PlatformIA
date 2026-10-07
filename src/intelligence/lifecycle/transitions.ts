import type { Lifecycle } from '../definitions/types'
import type { ExecutionMode } from '../records'

const TRANSITIONS: Readonly<Record<Lifecycle, readonly Lifecycle[]>> = {
  draft: ['test'],
  test: ['active', 'draft'],
  active: ['disabled'],
  disabled: ['test', 'draft'],
}

export function canTransition(from: Lifecycle, to: Lifecycle): boolean {
  return TRANSITIONS[from].includes(to)
}

export function allowsMode(lifecycle: Lifecycle, mode: ExecutionMode): boolean {
  if (lifecycle === 'active') return true
  if (lifecycle === 'test') return mode === 'test'
  return false
}
