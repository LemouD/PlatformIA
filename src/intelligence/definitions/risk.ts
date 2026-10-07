import type { RiskLevel } from './types'

export interface ToolPolicy {
  writes: boolean
  destructive: boolean
}

/** Empty in v1: no agent may use a tool. Each tool is added by hand, in a reviewed commit. */
export const TOOL_WHITELIST: Readonly<Record<string, ToolPolicy>> = {}

export function computeRiskLevel(tools: readonly string[]): RiskLevel {
  let level: RiskLevel = 'read_only'
  for (const tool of tools) {
    const policy = Object.hasOwn(TOOL_WHITELIST, tool) ? TOOL_WHITELIST[tool] : undefined
    if (!policy || policy.destructive) return 'destructive'
    if (policy.writes) level = 'write'
  }
  return level
}
