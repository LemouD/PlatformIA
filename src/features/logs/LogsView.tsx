'use client'

import { Pause, ScrollText } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSystemState } from '@/store/SystemProvider'
import { filterLogs, formatLogTime, isAtBottom, LEVEL_FILTERS, LEVEL_META } from './log-view'
import type { LevelFilter } from './log-view'

const CONTROL = 'h-10 rounded-control border border-line-control bg-surface-sunken px-3 text-sm text-ink'

/** Live, filterable system logs with auto-scroll that pauses when the user scrolls up (spec 15.2). */
export function LogsView() {
  const state = useSystemState()
  const [level, setLevel] = useState<LevelFilter>('all')
  const [agentId, setAgentId] = useState('all')
  const [text, setText] = useState('')
  const [pausedAtCount, setPausedAtCount] = useState<number | null>(null)
  const stream = useRef<HTMLOListElement>(null)

  const executionIds = useMemo(() => {
    if (agentId === 'all') return null
    return new Set(
      Object.values(state.executions)
        .filter((record) => record.execution.agentId === agentId)
        .map((record) => record.execution.id),
    )
  }, [agentId, state.executions])

  const lines = filterLogs(state.logs, { level, executionIds, text })
  const live = pausedAtCount === null
  const newLines = live ? 0 : Math.max(0, lines.length - pausedAtCount)

  useEffect(() => {
    const element = stream.current
    if (element && live) element.scrollTop = element.scrollHeight
  }, [lines.length, live])

  function onScroll() {
    const element = stream.current
    if (!element) return
    if (isAtBottom(element.scrollTop, element.scrollHeight, element.clientHeight)) setPausedAtCount(null)
    else if (pausedAtCount === null) setPausedAtCount(lines.length)
  }

  function backToLive() {
    setPausedAtCount(null)
    const element = stream.current
    if (element) element.scrollTop = element.scrollHeight
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pt-4 pb-6 md:px-9 md:pt-[30px]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[10px] uppercase text-info">{state.logs.length} lines kept</p>
          <h1 className="font-display text-[28px] leading-none italic text-ink md:text-[40px]">Logs</h1>
        </div>
        <p
          aria-live="polite"
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase ${
            live ? 'border-success/60 text-success' : 'border-warning/60 text-warning'
          }`}
        >
          {live ? <span aria-hidden className="size-2 rounded-full bg-success" /> : <Pause aria-hidden size={12} />}
          {live ? 'Live' : 'Paused · auto-scroll off'}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Level" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:rounded-control md:border md:border-line-control md:p-1 md:px-1">
          {LEVEL_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={level === option}
              onClick={() => setLevel(option)}
              className={`h-10 shrink-0 rounded-[6px] px-3 font-mono text-xs uppercase md:h-8 ${
                level === option ? 'bg-surface-raised text-brass-light ring-1 ring-accent' : 'text-ink-soft'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="logs-agent">
          Agent
        </label>
        <select id="logs-agent" value={agentId} onChange={(event) => setAgentId(event.target.value)} className={CONTROL}>
          <option value="all">All agents</option>
          {state.agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="logs-search">
          Search component or message
        </label>
        <input
          id="logs-search"
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Filter by component or message"
          className={`${CONTROL} min-w-0 flex-1 text-base max-md:hidden md:text-sm`}
        />
      </div>

      <div className="relative">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-panel border border-line bg-surface px-6 py-14 text-center">
            <ScrollText aria-hidden size={32} className="text-accent" />
            <p className="text-sm text-ink-soft">
              {state.logs.length === 0
                ? 'No logs yet. They appear as soon as an agent runs.'
                : 'No line matches these filters.'}
            </p>
          </div>
        ) : (
          <ol
            ref={stream}
            onScroll={onScroll}
            aria-label="Log lines"
            className="h-[calc(100dvh-300px)] min-h-[320px] overflow-y-auto rounded-panel border border-line bg-surface-sunken p-2 font-mono text-xs tabular-nums"
          >
            {lines.map((line) => {
              const meta = LEVEL_META[line.level]
              return (
                <li
                  key={line.id}
                  className={`grid grid-cols-[auto_auto_1fr] gap-x-3 gap-y-1 rounded-[6px] px-2 py-1.5 md:grid-cols-[110px_56px_180px_1fr] ${meta.row}`}
                >
                  <span className="text-ink-muted">
                    <span className="max-md:hidden">{formatLogTime(line.timestamp, true)}</span>
                    <span className="md:hidden">{formatLogTime(line.timestamp, false)}</span>
                  </span>
                  <span className={meta.text}>{meta.label}</span>
                  <span className="truncate text-accent">{line.component}</span>
                  <span className="col-span-3 break-words text-ink md:col-span-1">{line.message}</span>
                </li>
              )
            })}
          </ol>
        )}

        {!live ? (
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <div className="flex items-center gap-3 rounded-full border border-line-strong bg-surface py-1.5 pr-1.5 pl-4 shadow-panel">
              <span className="text-sm text-ink-soft">
                {newLines} new line{newLines === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={backToLive}
                className="h-11 rounded-full bg-accent px-4 text-sm font-semibold text-on-brass"
              >
                Back to live
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
