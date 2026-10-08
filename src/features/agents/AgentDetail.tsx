'use client'

import { ArrowLeft, Pause, Play, ScrollText } from 'lucide-react'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { Panel, PanelHeading } from '@/components/ui/Panel'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { STATUS_META } from '@/design/status'
import type { StepStatus } from '@/domain/events'
import { AgentRobot } from '@/features/agents/robot/AgentRobot'
import { AgentEnvironment } from '@/features/ecosystem/AgentEnvironment'
import { formatLogTime, LEVEL_META } from '@/features/logs/log-view'
import { TASK_STATUS_META } from '@/features/tasks/task-view'
import { formatCompactNumber, formatUsd } from '@/lib/format'
import { useSystemActions, useSystemState } from '@/store/SystemProvider'
import { agentLogs, agentStats, currentExecution, currentTask, formatLatency } from './agent-view'

const LOG_TAIL = 8

const STEP_DOT: Record<StepStatus, string> = {
  pending: 'border border-line-control',
  running: 'bg-warning',
  success: 'bg-success',
  failed: 'bg-danger',
  skipped: 'bg-ink-muted',
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-panel border border-line bg-surface px-4 py-3">
      <dt className="font-mono text-[9px] font-semibold uppercase text-ink-muted">{label}</dt>
      <dd className="truncate font-display text-lg italic text-ink">{children}</dd>
    </div>
  )
}

function PausedBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink-muted bg-surface-raised px-[9px] py-[5px] font-mono text-[9px] font-semibold uppercase text-ink-muted">
      <Pause aria-hidden size={9} />
      Paused
    </span>
  )
}

function Chips({ items, empty }: { items: readonly string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-ink-muted">{empty}</p>
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item} className="rounded-full border border-line-control px-3 py-1 font-mono text-[11px] text-ink-soft">
          {item}
        </li>
      ))}
    </ul>
  )
}

/** One agent, live: state, current task, execution timeline and its own log lines (Velvet reference 20:2). */
export function AgentDetail({ agentId }: { agentId: string }) {
  const state = useSystemState()
  const { setAvailability } = useSystemActions()
  const agent = state.agents.find((candidate) => candidate.id === agentId)

  if (!agent) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-3 px-4 py-14 text-center">
        <h1 className="font-display text-3xl italic text-ink">This agent is gone</h1>
        <p className="text-sm text-ink-soft">It was removed while you were away.</p>
        <Link href="/" className="text-sm text-accent underline underline-offset-4">
          Back to the Command Center
        </Link>
      </div>
    )
  }

  const paused = agent.availability === 'paused'
  const stats = agentStats(state, agent.id)
  const task = currentTask(state, agent.id)
  const execution = currentExecution(state, agent.id, task)
  const logs = agentLogs(state, agent.id, LOG_TAIL)
  const statusMeta = STATUS_META[agent.status]

  return (
    <div
      className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 pt-4 pb-6 md:px-9 md:pt-[30px]"
      style={{ '--agent-state': statusMeta.color } as CSSProperties}
    >
      <Link href="/" className="flex w-fit items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft aria-hidden size={14} />
        Command Center
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="font-mono text-[10px] uppercase text-info">
            {agent.type} · {agent.model}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[28px] leading-none italic text-ink md:text-[40px]">{agent.name}</h1>
            {paused ? <PausedBadge /> : <StatusBadge status={agent.status} />}
          </div>
          <p className="max-w-2xl text-sm text-ink-soft">{agent.description}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAvailability(agent.id, paused ? 'online' : 'paused')}
            className="flex h-11 items-center gap-2 rounded-control border border-line-control px-4 text-sm text-ink hover:border-accent"
          >
            {paused ? <Play aria-hidden size={16} /> : <Pause aria-hidden size={16} />}
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            disabled
            title="Running a task by hand arrives with the agent engine"
            className="flex h-11 items-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-on-brass disabled:opacity-45"
          >
            Run task
          </button>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Model">{agent.model}</Tile>
        <Tile label="Tools">{agent.tools.length}</Tile>
        <Tile label="Memory">{agent.memoryId ? 'Enabled' : 'None'}</Tile>
        <Tile label="Executions">{stats.executions}</Tile>
        <Tile label="Success rate">{stats.successRate === null ? '—' : `${stats.successRate}%`}</Tile>
        <Tile label="Avg latency">{formatLatency(stats.averageLatencyMs)}</Tile>
      </dl>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel labelledBy="agent-live">
          <PanelHeading id="agent-live" eyebrow="Live" title="Environment" detail={paused ? 'paused' : statusMeta.description} />
          <div className={`relative mx-auto aspect-[200/130] w-full max-w-[460px] ${paused ? 'opacity-55 grayscale' : ''}`}>
            <AgentEnvironment environment={agent.environment} status={agent.status} showScene className="absolute inset-0 h-full w-full" />
            <div className="absolute bottom-[14%] left-1/2 -translate-x-1/2">
              <AgentRobot
                status={agent.status}
                environment={agent.environment}
                role={agent.type}
                variant="specimen"
                facing="right"
                moving={false}
                progress={task?.status === 'running' ? task.progress : undefined}
                size={150}
              />
            </div>
          </div>
          <p className="text-center text-sm text-ink-soft" aria-live="polite">
            {paused ? 'Paused · takes no new tasks' : agent.activity}
          </p>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel labelledBy="agent-task">
            <PanelHeading
              id="agent-task"
              eyebrow="Current task"
              title={task ? task.title : 'Nothing yet'}
              detail={task ? TASK_STATUS_META[task.status].label : undefined}
            />
            {task ? (
              <div className="flex flex-col gap-3">
                <span aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                  <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${task.progress}%` }} />
                </span>
                <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink-soft">
                  <span>{task.progress}%</span>
                  {execution?.finishedAt ? (
                    <>
                      <span>{formatCompactNumber(execution.tokens)} tokens</span>
                      <span>{formatUsd(execution.costUsd)}</span>
                      <span>{formatLatency(execution.finishedAt - execution.execution.startedAt)}</span>
                    </>
                  ) : null}
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Give NOVA a command and it will hand the right ones to {agent.name}.</p>
            )}
          </Panel>

          <Panel labelledBy="agent-timeline">
            <PanelHeading id="agent-timeline" eyebrow="Execution" title="Timeline" detail={execution?.result ?? undefined} />
            {execution && execution.steps.length > 0 ? (
              <ol className="flex flex-col">
                {execution.steps.map((step, index) => (
                  <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < execution.steps.length - 1 ? (
                      <span aria-hidden className="absolute top-3 left-[4px] h-full w-px bg-line" />
                    ) : null}
                    <span aria-hidden className={`relative mt-1 size-2.5 shrink-0 rounded-full ${STEP_DOT[step.status]}`} />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="flex flex-wrap items-baseline gap-x-3 font-mono text-[11px] font-semibold uppercase text-ink">
                        {step.label}
                        <span className="font-normal text-ink-muted">{formatLogTime(step.timestamp, false)}</span>
                      </p>
                      <p className="text-sm text-ink-soft">{step.message}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-soft">The steps of the next execution will show here as they happen.</p>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel labelledBy="agent-logs">
          <header className="flex items-end justify-between">
            <div className="flex flex-col gap-[5px]">
              <p className="font-mono text-[9px] font-semibold uppercase text-accent">Logs</p>
              <h2 id="agent-logs" className="font-display text-lg italic text-ink">
                Latest lines
              </h2>
            </div>
            <Link href="/logs" className="flex items-center gap-1.5 text-sm text-accent">
              <ScrollText aria-hidden size={14} />
              All logs
            </Link>
          </header>
          {logs.length > 0 ? (
            <ul className="flex flex-col gap-1 rounded-control bg-surface-sunken p-3 font-mono text-[11px]">
              {logs.map((log) => {
                const level = LEVEL_META[log.level]
                return (
                  <li key={log.id} className={`flex gap-3 rounded px-1 ${level.row}`}>
                    <span className="shrink-0 text-ink-muted">{formatLogTime(log.timestamp, false)}</span>
                    <span className={`w-11 shrink-0 ${level.text}`}>{level.label}</span>
                    <span className="min-w-0 break-words text-ink-soft">{log.message}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">No log lines from this agent yet.</p>
          )}
        </Panel>

        <Panel labelledBy="agent-access">
          <PanelHeading id="agent-access" eyebrow="Access" title="Tools & permissions" />
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[9px] font-semibold uppercase text-ink-muted">Tools</h3>
            <Chips items={agent.tools} empty="No tools." />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[9px] font-semibold uppercase text-ink-muted">Permissions</h3>
            <Chips items={agent.permissions} empty="No permissions." />
          </div>
        </Panel>
      </div>
    </div>
  )
}
