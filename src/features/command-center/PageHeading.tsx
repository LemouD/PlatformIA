'use client'

import { Bot, Play, ScrollText, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { COMMAND_INPUT_ID } from './command'
import { LiveClock } from './LiveClock'

const ACTION_BASE =
  'flex h-[42px] items-center gap-[9px] rounded-control border px-[15px] text-[11px] font-semibold'
const ACTION_SECONDARY = `${ACTION_BASE} border-line bg-surface text-ink-soft`
const ACTION_PRIMARY = `${ACTION_BASE} border-accent bg-accent text-canvas`

function focusCommandInput() {
  document.getElementById(COMMAND_INPUT_ID)?.focus()
}

export function PageHeading() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-[7px]">
        <LiveClock />
        <h1 className="font-display text-[32px] leading-none italic text-ink">Command center</h1>
        <p className="text-xs text-ink-muted">
          A live view of your personal AI ecosystem and the entities working inside it.
        </p>
      </div>

      <div className="flex gap-2">
        <button type="button" disabled className={`${ACTION_SECONDARY} disabled:opacity-50`}>
          <Bot aria-hidden size={14} />
          New Agent
        </button>
        <button type="button" disabled className={`${ACTION_SECONDARY} disabled:opacity-50`}>
          <Play aria-hidden size={14} />
          Run Agent
        </button>
        <button type="button" onClick={focusCommandInput} className={ACTION_PRIMARY}>
          <Sparkles aria-hidden size={14} />
          Ask NOVA
        </button>
        <Link href="/logs" className={ACTION_SECONDARY}>
          <ScrollText aria-hidden size={14} />
          View Logs
        </Link>
      </div>
    </div>
  )
}
