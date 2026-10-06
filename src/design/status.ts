import type { AgentStatus } from '@/domain/types'

export interface StatusMeta {
  label: string
  /** Lower-case phrase used in accessible names, e.g. "Research Agent, working". */
  description: string
  color: string
  text: string
  border: string
  bg: string
}

export const STATUS_META: Record<AgentStatus, StatusMeta> = {
  IDLE: {
    label: 'Idle',
    description: 'idle',
    color: 'var(--color-brass-light)',
    text: 'text-brass-light',
    border: 'border-brass-light',
    bg: 'bg-brass-light',
  },
  THINKING: {
    label: 'Thinking',
    description: 'thinking',
    color: 'var(--color-info)',
    text: 'text-info',
    border: 'border-info',
    bg: 'bg-info',
  },
  WORKING: {
    label: 'Working',
    description: 'working',
    color: 'var(--color-amethyst)',
    text: 'text-amethyst',
    border: 'border-amethyst',
    bg: 'bg-amethyst',
  },
  WAITING_APPROVAL: {
    label: 'Waiting',
    description: 'waiting for approval',
    color: 'var(--color-warning)',
    text: 'text-warning',
    border: 'border-warning',
    bg: 'bg-warning',
  },
  ERROR: {
    label: 'Error',
    description: 'in error',
    color: 'var(--color-danger)',
    text: 'text-danger',
    border: 'border-danger',
    bg: 'bg-danger',
  },
  COMPLETED: {
    label: 'Completed',
    description: 'completed',
    color: 'var(--color-success)',
    text: 'text-success',
    border: 'border-success',
    bg: 'bg-success',
  },
}
