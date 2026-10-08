import type { Task, TaskStatus } from '@/domain/events'

export const TASK_STATUSES: readonly TaskStatus[] = ['queued', 'running', 'waiting_approval', 'completed', 'failed']

export interface TaskStatusMeta {
  label: string
  /** Tailwind classes for the status dot; queued is a hollow ring. */
  dot: string
  text: string
}

export const TASK_STATUS_META: Record<TaskStatus, TaskStatusMeta> = {
  queued: { label: 'Queued', dot: 'border border-ink-muted bg-transparent', text: 'text-ink-muted' },
  running: { label: 'Running', dot: 'bg-amethyst', text: 'text-amethyst' },
  waiting_approval: { label: 'Waiting approval', dot: 'bg-warning', text: 'text-warning' },
  completed: { label: 'Completed', dot: 'bg-success', text: 'text-success' },
  failed: { label: 'Failed', dot: 'bg-danger', text: 'text-danger' },
}

const ATTENTION: Partial<Record<TaskStatus, number>> = { waiting_approval: 0, failed: 1 }

/** Tasks that need the user first (waiting approval, then failed), then the most recent. */
export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const rank = (ATTENTION[a.status] ?? 2) - (ATTENTION[b.status] ?? 2)
    return rank !== 0 ? rank : b.createdAt - a.createdAt || a.id.localeCompare(b.id)
  })
}

export function countByStatus(tasks: readonly Task[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = { queued: 0, running: 0, waiting_approval: 0, completed: 0, failed: 0 }
  for (const task of tasks) counts[task.status] += 1
  return counts
}

/** "42 s", "3 min 05 s", "1 h 02 min". Running tasks are measured up to `now`. */
export function formatDuration(task: Task, now: number): string {
  if (task.startedAt === null) return '—'
  const seconds = Math.max(0, Math.round(((task.completedAt ?? now) - task.startedAt) / 1000))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ${String(seconds % 60).padStart(2, '0')} s`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
}
