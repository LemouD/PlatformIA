'use client'

import { ChevronRight, ListChecks, Sparkles } from 'lucide-react'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { STATUS_META } from '@/design/status'
import type { Task, TaskStatus } from '@/domain/events'
import type { Agent } from '@/domain/types'
import { AgentRobot } from '@/features/agents/robot/AgentRobot'
import { formatClockTime } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { useSystemState } from '@/store/SystemProvider'
import { countByStatus, formatDuration, sortTasks, TASK_STATUS_META, TASK_STATUSES } from './task-view'

type Filter = 'all' | TaskStatus

function StatusDot({ status }: { status: TaskStatus }) {
  return <span aria-hidden className={`size-2 shrink-0 rounded-full ${TASK_STATUS_META[status].dot}`} />
}

function StatusLabel({ status }: { status: TaskStatus }) {
  const meta = TASK_STATUS_META[status]
  return (
    <span className={`flex items-center gap-2 text-sm ${meta.text}`}>
      <StatusDot status={status} />
      {meta.label}
    </span>
  )
}

function Progress({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="h-1.5 w-[120px] max-w-full overflow-hidden rounded-full bg-surface-sunken">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </span>
      <span className="font-mono text-xs tabular-nums text-ink-soft">{value}%</span>
    </span>
  )
}

function AgentBadge({ agent, size }: { agent: Agent | undefined; size: number }) {
  if (!agent) return <span className="text-sm text-ink-muted">Unknown agent</span>
  return (
    <span className="flex min-w-0 items-center gap-2" style={{ '--agent-state': STATUS_META[agent.status].color } as CSSProperties}>
      <span aria-hidden className="shrink-0">
        <AgentRobot
          status={agent.status}
          environment={agent.environment}
          role={agent.type}
          variant="specimen"
          facing="right"
          moving={false}
          size={size}
        />
      </span>
      <span className="truncate font-display text-[15px] italic text-ink">{agent.name}</span>
    </span>
  )
}

const ASK_NOVA = 'flex h-11 items-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-on-brass'

/** Every task born from a command, most urgent first (agents design spec 15.1). */
export function TasksView() {
  const state = useSystemState()
  const now = useNow(1000)
  const [filter, setFilter] = useState<Filter>('all')

  const counts = countByStatus(state.tasks)
  const sorted = sortTasks(state.tasks)
  const visible = filter === 'all' ? sorted : sorted.filter((task) => task.status === filter)
  const agentOf = (task: Task) => state.agents.find((agent) => agent.id === task.agentId)
  const duration = (task: Task) => (now === null ? '—' : formatDuration(task, now))

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 pt-4 pb-6 md:px-9 md:pt-[30px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[10px] uppercase text-info">
            {state.tasks.length} tasks · {counts.running} running · {counts.waiting_approval} waiting for you
          </p>
          <h1 className="font-display text-[28px] leading-none italic text-ink md:text-[40px]">Tasks</h1>
        </div>
        <Link href="/" className={`${ASK_NOVA} max-md:hidden`}>
          <Sparkles aria-hidden size={16} />
          Ask NOVA
        </Link>
      </header>

      {state.tasks.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-panel border border-line bg-surface px-6 py-14 text-center">
          <ListChecks aria-hidden size={32} className="text-accent" />
          <h2 className="font-display text-2xl italic text-ink">No tasks yet</h2>
          <p className="max-w-md text-sm text-ink-soft">
            Tasks appear here when you give NOVA a command. NOVA hands each one to the right agent.
          </p>
          <Link href="/" className={ASK_NOVA}>
            <Sparkles aria-hidden size={16} />
            Ask NOVA
          </Link>
        </section>
      ) : (
        <>
          <div role="radiogroup" aria-label="Filter by status" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
            {(['all', ...TASK_STATUSES] as const).map((option) => {
              const selected = filter === option
              const count = option === 'all' ? state.tasks.length : counts[option]
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setFilter(option)}
                  className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm md:h-9 ${
                    selected ? 'border-accent bg-surface-raised text-ink' : 'border-line-control text-ink-soft'
                  }`}
                >
                  {option === 'all' ? null : <StatusDot status={option} />}
                  {option === 'all' ? 'All' : TASK_STATUS_META[option].label}
                  <span className="font-mono text-xs tabular-nums text-ink-muted">{count}</span>
                </button>
              )
            })}
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-ink-soft">
              No {filter === 'all' ? '' : TASK_STATUS_META[filter].label.toLowerCase()} tasks. Clear the filter to see all{' '}
              {state.tasks.length} tasks.{' '}
              <button type="button" onClick={() => setFilter('all')} className="text-accent underline underline-offset-4">
                Clear filter
              </button>
            </p>
          ) : (
            <>
              <div role="table" aria-label="Tasks" className="max-md:hidden">
                <div role="row" className="grid grid-cols-[minmax(0,400px)_minmax(0,1fr)_170px_180px_110px_90px_24px] gap-4 border-b border-line px-4 pb-2 font-mono text-[10px] uppercase text-ink-muted">
                  <span role="columnheader">Task</span>
                  <span role="columnheader">Agent</span>
                  <span role="columnheader">Status</span>
                  <span role="columnheader">Progress</span>
                  <span role="columnheader">Duration</span>
                  <span role="columnheader">Started</span>
                  <span />
                </div>
                {visible.map((task) => (
                  <Link
                    key={task.id}
                    role="row"
                    href={`/agents/${task.agentId}`}
                    className="grid h-16 grid-cols-[minmax(0,400px)_minmax(0,1fr)_170px_180px_110px_90px_24px] items-center gap-4 border-b border-line px-4 hover:bg-surface"
                  >
                    <span role="cell" className="truncate text-sm text-ink">{task.title}</span>
                    <span role="cell"><AgentBadge agent={agentOf(task)} size={40} /></span>
                    <span role="cell"><StatusLabel status={task.status} /></span>
                    <span role="cell"><Progress value={task.progress} /></span>
                    <span role="cell" className="font-mono text-xs tabular-nums text-ink-soft">{duration(task)}</span>
                    <span role="cell" className="font-mono text-xs tabular-nums text-ink-muted">
                      {task.startedAt === null ? '—' : formatClockTime(task.startedAt)}
                    </span>
                    <ChevronRight aria-hidden size={16} className="text-ink-muted" />
                  </Link>
                ))}
              </div>

              <ul className="flex flex-col gap-2 md:hidden">
                {visible.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/agents/${task.agentId}`}
                      className={`flex flex-col gap-2 rounded-[14px] border bg-surface p-3 ${
                        task.status === 'waiting_approval' ? 'border-warning' : 'border-line'
                      }`}
                    >
                      <span className="line-clamp-2 text-[15px] text-ink">{task.title}</span>
                      <span className="flex items-center justify-between gap-2">
                        <AgentBadge agent={agentOf(task)} size={44} />
                        <StatusLabel status={task.status} />
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <Progress value={task.progress} />
                        <span className="font-mono text-xs tabular-nums text-ink-soft">{duration(task)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
