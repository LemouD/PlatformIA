'use client'

import { useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import type { Approval } from '@/domain/events'
import type { Agent } from '@/domain/types'
import { AgentRobot } from '@/features/agents/robot/AgentRobot'
import { formatClockTime } from '@/lib/format'
import { shouldDismissSheet, sortPendingApprovals } from './pending'

const WAITING_COLOR = { '--agent-state': 'var(--color-warning)' } as CSSProperties

interface PendingApprovalsProps {
  approvals: readonly Approval[]
  agents: readonly Agent[]
  /** Sends the decision through the event stream. Absent until the live engine is connected. */
  onDecide?: (approvalId: string, decision: 'approved' | 'rejected') => void
}

/** Amber request cards and the bottom sheet where the user approves or refuses. */
export function PendingApprovals({ approvals, agents, onDecide }: PendingApprovalsProps) {
  const sheet = useRef<HTMLDialogElement>(null)
  const dragStart = useRef<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drag, setDrag] = useState(0)

  const pending = sortPendingApprovals(approvals)
  const selected = pending.find((approval) => approval.id === selectedId) ?? null
  const agentOf = (approval: Approval) => agents.find((agent) => agent.id === approval.agentId)

  if (pending.length === 0) return null

  function open(id: string) {
    setSelectedId(id)
    setDrag(0)
    sheet.current?.showModal()
  }

  function close() {
    sheet.current?.close()
    dragStart.current = null
    setDrag(0)
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    dragStart.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragStart.current === null) return
    setDrag(Math.max(0, event.clientY - dragStart.current))
  }

  function onPointerUp() {
    if (shouldDismissSheet(drag)) close()
    else setDrag(0)
    dragStart.current = null
  }

  const selectedAgent = selected ? agentOf(selected) : undefined

  return (
    <section aria-label="Pending approvals" className="flex flex-col gap-2">
      {pending.map((approval) => {
        const agent = agentOf(approval)
        return (
          <article
            key={approval.id}
            className="flex items-center gap-3 rounded-panel border border-warning/60 bg-surface p-4"
            style={WAITING_COLOR}
          >
            <span aria-hidden className="shrink-0">
              <AgentRobot
                status="WAITING_APPROVAL"
                environment={agent?.environment ?? 'generic'}
                role={agent?.type ?? 'specialist'}
                variant="specimen"
                facing="right"
                moving={false}
                size={56}
              />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="font-mono text-[10px] uppercase text-warning">
                {agent?.name ?? 'An agent'} Â· approval needed
              </p>
              <p className="text-sm text-ink">{approval.summary}</p>
              <button
                type="button"
                onClick={() => open(approval.id)}
                className="h-12 rounded-control bg-warning px-4 text-sm font-semibold text-canvas"
              >
                Review request
              </button>
            </div>
          </article>
        )
      })}

      <dialog
        ref={sheet}
        aria-labelledby="approval-title"
        onClose={() => setSelectedId(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) close()
        }}
        className="mt-auto mb-0 w-full max-w-[560px] rounded-t-[26px] border-t border-line-strong bg-surface p-0 text-ink backdrop:bg-[rgb(6_1_4/0.72)] md:mx-auto"
        style={{ transform: drag > 0 ? `translateY(${drag}px)` : undefined }}
      >
        {selected ? (
          <div className="flex flex-col gap-4 px-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))]">
            <div
              className="flex h-8 cursor-grab touch-none items-center justify-center"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <span aria-hidden className="h-1 w-10 rounded-full bg-line-strong" />
            </div>

            <div
              aria-hidden
              className="relative flex h-[132px] items-end justify-center overflow-hidden rounded-card bg-surface-sunken"
              style={WAITING_COLOR}
            >
              <span
                className="absolute top-0 h-full w-24 opacity-45"
                style={{
                  background: 'linear-gradient(to bottom, transparent, var(--agent-state))',
                  clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
                }}
              />
              <span className="relative pb-2">
                <AgentRobot
                  status="WAITING_APPROVAL"
                  environment={selectedAgent?.environment ?? 'generic'}
                  role={selectedAgent?.type ?? 'specialist'}
                  variant="specimen"
                  facing="right"
                  moving={false}
                  size={104}
                />
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <time
                dateTime={new Date(selected.requestedAt).toISOString()}
                className="font-mono text-[11px] text-ink-muted"
              >
                {selectedAgent?.name ?? 'An agent'} Â· requested at {formatClockTime(selected.requestedAt)}
              </time>
              <h2 id="approval-title" className="font-display text-2xl italic">
                {selected.summary}
              </h2>
            </div>

            <dl className="divide-y divide-line rounded-card border border-line text-sm">
              <div className="flex justify-between gap-4 px-3 py-2.5">
                <dt className="shrink-0 whitespace-nowrap text-ink-muted">Action</dt>
                <dd className="text-right text-ink">{selected.action ?? 'Not specified'}</dd>
              </div>
              <div className="flex justify-between gap-4 px-3 py-2.5">
                <dt className="shrink-0 whitespace-nowrap text-ink-muted">Data used</dt>
                <dd className="text-right text-ink">{selected.dataUsed ?? 'Not specified'}</dd>
              </div>
              <div className="flex justify-between gap-4 px-3 py-2.5">
                <dt className="shrink-0 whitespace-nowrap text-ink-muted">Leaves AI OS?</dt>
                <dd className={selected.leavesAiOs ? 'text-warning' : 'text-ink'}>
                  {selected.leavesAiOs === undefined ? 'Unknown' : selected.leavesAiOs ? 'Yes' : 'No'}
                </dd>
              </div>
            </dl>

            {selected.preview ? (
              <pre className="max-h-40 overflow-auto rounded-card bg-surface-sunken p-3 font-mono text-xs whitespace-pre-wrap text-ink-soft">
                {selected.preview}
              </pre>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!onDecide}
                onClick={() => {
                  onDecide?.(selected.id, 'rejected')
                  close()
                }}
                className="h-[52px] rounded-control border border-ink-soft text-base text-ink disabled:opacity-50"
              >
                Refuse
              </button>
              <button
                type="button"
                disabled={!onDecide}
                onClick={() => {
                  onDecide?.(selected.id, 'approved')
                  close()
                }}
                className="h-[52px] rounded-control bg-accent text-base font-semibold text-canvas disabled:opacity-50"
              >
                Approve
              </button>
            </div>
            <p className="text-center text-xs text-ink-muted">
              {onDecide
                ? 'Refuse cancels this action. Approve lets the agent carry it out.'
                : 'Decisions will be available once the live engine is connected.'}
            </p>
          </div>
        ) : null}
      </dialog>
    </section>
  )
}
