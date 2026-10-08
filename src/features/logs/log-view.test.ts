import { describe, expect, it } from 'vitest'
import type { Log } from '@/domain/events'
import { filterLogs, formatLogTime, isAtBottom } from './log-view'

function log(id: string, level: Log['level'], executionId: string | null, message: string, component = 'engine.runner'): Log {
  return { id, executionId, level, component, timestamp: 0, message }
}

const LOGS = [
  log('1', 'debug', 'x1', 'Routing command'),
  log('2', 'info', 'x1', 'Request sent', 'llm.client'),
  log('3', 'warn', null, 'Ignored event'),
  log('4', 'error', 'x2', 'Model unavailable'),
]

describe('filterLogs', () => {
  it('keeps everything with no filter', () => {
    expect(filterLogs(LOGS, { level: 'all', executionIds: null, text: '' })).toHaveLength(4)
  })

  it('filters by level', () => {
    expect(filterLogs(LOGS, { level: 'error', executionIds: null, text: '' }).map((item) => item.id)).toEqual(['4'])
  })

  it('filters by the executions of one agent, dropping system lines', () => {
    const ids = filterLogs(LOGS, { level: 'all', executionIds: new Set(['x1']), text: '' }).map((item) => item.id)
    expect(ids).toEqual(['1', '2'])
  })

  it('searches component and message, ignoring case', () => {
    expect(filterLogs(LOGS, { level: 'all', executionIds: null, text: 'LLM' }).map((item) => item.id)).toEqual(['2'])
  })
})

describe('formatLogTime', () => {
  it('shows milliseconds on desktop only', () => {
    const at = new Date(2026, 9, 8, 16, 42, 39, 118).getTime()
    expect(formatLogTime(at, true)).toBe('16:42:39.118')
    expect(formatLogTime(at, false)).toBe('16:42:39')
  })
})

describe('isAtBottom', () => {
  it('treats the last few pixels as live', () => {
    expect(isAtBottom(980, 1500, 500)).toBe(true)
    expect(isAtBottom(800, 1500, 500)).toBe(false)
  })
})
