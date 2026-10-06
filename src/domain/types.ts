export const AGENT_STATUSES = [
  'IDLE',
  'WORKING',
  'THINKING',
  'WAITING_APPROVAL',
  'ERROR',
  'COMPLETED',
] as const

export type AgentStatus = (typeof AGENT_STATUSES)[number]

export type AgentAvailability = 'online' | 'paused'

export type AgentType = 'orchestrator' | 'specialist'

export type EnvironmentKind = 'research' | 'coding' | 'home' | 'personal' | 'generic'

export interface Agent {
  id: string
  name: string
  type: AgentType
  status: AgentStatus
  availability: AgentAvailability
  /** Short human-readable line describing what the agent is doing right now. */
  activity: string
  model: string
  description: string
  tools: string[]
  permissions: string[]
  memoryId: string | null
  currentTaskId: string | null
  environment: EnvironmentKind
}

export type Tone = 'info' | 'accent' | 'success' | 'warning' | 'danger'

export interface ActivityEntry {
  id: string
  timestamp: number
  tone: Tone
  message: string
}

export interface SystemMetrics {
  runningTasks: number
  /** Percentage between 0 and 100. */
  apiUptime: number
  tokens: number
  /** Euros spent today. */
  costToday: number
}

export type SystemHealth = 'nominal' | 'degraded'

export interface CommandCenterSnapshot {
  agents: Agent[]
  activity: ActivityEntry[]
  metrics: SystemMetrics
  health: SystemHealth
  syncedAt: number
  objective: string
  /** Agent ids, in the order information is flowing. Empty when no handoff is active. */
  handoffChain: string[]
  suggestions: string[]
}
