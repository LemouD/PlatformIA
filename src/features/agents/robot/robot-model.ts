import type { AgentStatus, AgentType } from '@/domain/types'

export type RobotProp = 'orchestrator' | 'research' | 'coding' | 'home' | 'personal' | null

export function resolveRobotProp(role: AgentType, environment: string): RobotProp {
  if (role === 'orchestrator') return 'orchestrator'
  switch (environment) {
    case 'research':
    case 'coding':
    case 'home':
    case 'personal':
      return environment
    default:
      return null
  }
}

export type RobotPose = 'rest' | 'tray' | 'antenna-bent' | 'salute'

export interface StateMotion {
  /** Heartbeat period in seconds. */
  heartbeat: number
  irregular: boolean
  floats: boolean
  blinks: boolean
  pose: RobotPose
}

export const STATE_MOTION: Record<AgentStatus, StateMotion> = {
  IDLE: { heartbeat: 4, irregular: false, floats: true, blinks: true, pose: 'rest' },
  THINKING: { heartbeat: 2.4, irregular: false, floats: true, blinks: false, pose: 'rest' },
  WORKING: { heartbeat: 1.1, irregular: false, floats: true, blinks: true, pose: 'rest' },
  WAITING_APPROVAL: { heartbeat: 1.8, irregular: false, floats: false, blinks: true, pose: 'tray' },
  ERROR: { heartbeat: 0.7, irregular: true, floats: false, blinks: false, pose: 'antenna-bent' },
  COMPLETED: { heartbeat: 4, irregular: false, floats: true, blinks: false, pose: 'salute' },
}

export const ROBOT_VIEWBOX = { width: 240, height: 300 } as const

const MIN_WORLD_HEIGHT = 60

export function robotHeight(variant: 'world' | 'specimen', role: AgentType, scale = 1): number {
  if (variant === 'specimen') return 64
  const base = role === 'orchestrator' ? 104 : 84
  return Math.max(MIN_WORLD_HEIGHT, base * scale)
}

export const SPRING_A = { type: 'spring', stiffness: 260, damping: 18, mass: 1 } as const
