import { describe, expect, it } from 'vitest'
import type { Task, TaskStatus } from '@/domain/events'
import { countByStatus, formatDuration, sortTasks } from './task-view'

function task(id: string, status: TaskStatus, createdAt: number, extra: Partial<Task> = {}): Task {
  return { id, title: id, status, agentId: 'home', progress: 0, createdAt, startedAt: createdAt, completedAt: null, ...extra }
}

describe('sortTasks', () => {
  it('puts waiting approval first, then failed, then the most recent', () => {
    const sorted = sortTasks([
      task('old-running', 'running', 1),
      task('failed', 'failed', 2),
      task('new-done', 'completed', 9),
      task('waiting', 'waiting_approval', 3),
    ])
    expect(sorted.map((item) => item.id)).toEqual(['waiting', 'failed', 'new-done', 'old-running'])
  })
})

describe('countByStatus', () => {
  it('counts every status, including empty ones', () => {
    expect(countByStatus([task('a', 'running', 1), task('b', 'running', 2), task('c', 'failed', 3)])).toEqual({
      queued: 0,
      running: 2,
      waiting_approval: 0,
      completed: 0,
      failed: 1,
    })
  })
})

describe('formatDuration', () => {
  it('measures finished tasks between start and end', () => {
    expect(formatDuration(task('a', 'completed', 0, { completedAt: 42_000 }), 999_999)).toBe('42 s')
  })

  it('measures running tasks up to now', () => {
    expect(formatDuration(task('a', 'running', 0), 185_000)).toBe('3 min 05 s')
    expect(formatDuration(task('a', 'running', 0), 3_720_000)).toBe('1 h 02 min')
  })

  it('shows a dash for tasks not started yet', () => {
    expect(formatDuration(task('a', 'queued', 0, { startedAt: null }), 10)).toBe('—')
  })
})
