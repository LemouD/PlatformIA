import { describe, expect, it } from 'vitest'
import { AGENT_STATUSES } from '@/domain/types'
import { resolveRobotProp, robotHeight, STATE_MOTION } from './robot-model'

describe('resolveRobotProp', () => {
  it('gives each known environment its trade accessory', () => {
    expect(resolveRobotProp('specialist', 'research')).toBe('research')
    expect(resolveRobotProp('specialist', 'coding')).toBe('coding')
    expect(resolveRobotProp('specialist', 'home')).toBe('home')
    expect(resolveRobotProp('specialist', 'personal')).toBe('personal')
  })

  it('shows no accessory for generic or unknown environments', () => {
    expect(resolveRobotProp('specialist', 'generic')).toBeNull()
    expect(resolveRobotProp('specialist', 'teaching')).toBeNull()
  })

  it('gives the orchestrator its baton whatever the environment', () => {
    expect(resolveRobotProp('orchestrator', 'research')).toBe('orchestrator')
    expect(resolveRobotProp('orchestrator', 'generic')).toBe('orchestrator')
  })
})

describe('STATE_MOTION', () => {
  it('covers every status', () => {
    for (const status of AGENT_STATUSES) expect(STATE_MOTION[status]).toBeDefined()
  })

  it('lands the robot while it waits or fails', () => {
    expect(STATE_MOTION.WAITING_APPROVAL.floats).toBe(false)
    expect(STATE_MOTION.ERROR.floats).toBe(false)
    expect(STATE_MOTION.IDLE.floats).toBe(true)
  })

  it('speeds up the heartbeat with the workload', () => {
    expect(STATE_MOTION.IDLE.heartbeat).toBe(4)
    expect(STATE_MOTION.THINKING.heartbeat).toBe(2.4)
    expect(STATE_MOTION.WORKING.heartbeat).toBe(1.1)
    expect(STATE_MOTION.ERROR).toMatchObject({ heartbeat: 0.7, irregular: true, blinks: false })
  })

  it('blinks only with open eyes: idle, working and waiting', () => {
    const blinking = AGENT_STATUSES.filter((status) => STATE_MOTION[status].blinks)
    expect(blinking).toEqual(['IDLE', 'WORKING', 'WAITING_APPROVAL'])
  })

  it('maps gesture states to their pose', () => {
    expect(STATE_MOTION.WAITING_APPROVAL.pose).toBe('tray')
    expect(STATE_MOTION.ERROR.pose).toBe('antenna-bent')
    expect(STATE_MOTION.COMPLETED.pose).toBe('salute')
    expect(STATE_MOTION.THINKING.pose).toBe('rest')
  })
})

describe('robotHeight', () => {
  it('uses the spec sizes', () => {
    expect(robotHeight('world', 'specialist')).toBe(84)
    expect(robotHeight('world', 'orchestrator')).toBe(104)
    expect(robotHeight('specimen', 'specialist')).toBe(64)
  })

  it('follows the map scale without going under 60 px', () => {
    expect(robotHeight('world', 'specialist', 0.9)).toBeCloseTo(75.6)
    expect(robotHeight('world', 'specialist', 0.5)).toBe(60)
  })
})
