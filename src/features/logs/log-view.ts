import type { Log, LogLevel } from '@/domain/events'

export type LevelFilter = 'all' | LogLevel

export const LEVEL_FILTERS: readonly LevelFilter[] = ['all', 'debug', 'info', 'warn', 'error']

export const LEVEL_META: Record<LogLevel, { label: string; text: string; row: string }> = {
  debug: { label: 'DEBUG', text: 'text-ink-muted', row: '' },
  info: { label: 'INFO', text: 'text-ink-soft', row: '' },
  warn: { label: 'WARN', text: 'text-warning', row: '' },
  error: { label: 'ERROR', text: 'text-danger', row: 'bg-danger/8' },
}

export interface LogFilters {
  level: LevelFilter
  /** Execution ids that belong to the chosen agent, or null for every agent. */
  executionIds: ReadonlySet<string> | null
  text: string
}

export function filterLogs(logs: readonly Log[], filters: LogFilters): Log[] {
  const query = filters.text.trim().toLowerCase()
  return logs.filter((log) => {
    if (filters.level !== 'all' && log.level !== filters.level) return false
    if (filters.executionIds && (log.executionId === null || !filters.executionIds.has(log.executionId))) return false
    if (query && !`${log.component} ${log.message}`.toLowerCase().includes(query)) return false
    return true
  })
}

function pad(value: number, size = 2): string {
  return String(value).padStart(size, '0')
}

/** 16:42:39.118 on desktop, 16:42:39 on phones. */
export function formatLogTime(timestamp: number, withMilliseconds: boolean): string {
  const date = new Date(timestamp)
  const base = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return withMilliseconds ? `${base}.${pad(date.getMilliseconds(), 3)}` : base
}

/** Distance from the bottom, in px, under which the stream counts as following live. */
export const LIVE_THRESHOLD = 24

export function isAtBottom(scrollTop: number, scrollHeight: number, clientHeight: number): boolean {
  return scrollHeight - scrollTop - clientHeight <= LIVE_THRESHOLD
}
