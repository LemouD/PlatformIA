import Link from 'next/link'
import { Panel, PanelHeading } from '@/components/ui/Panel'
import { ToneDot } from '@/components/ui/ToneDot'
import type { ActivityEntry, Tone } from '@/domain/types'
import { formatClockTime } from '@/lib/format'

/** Phones show the latest events only; the rest lives in Logs. */
const PHONE_ENTRY_LIMIT = 4

const LEGEND: readonly { tone: Tone; label: string }[] = [
  { tone: 'info', label: 'Processing' },
  { tone: 'success', label: 'Success' },
  { tone: 'warning', label: 'Waiting' },
  { tone: 'danger', label: 'Error' },
]

interface LiveActivityProps {
  entries: readonly ActivityEntry[]
}

export function LiveActivity({ entries }: LiveActivityProps) {
  return (
    <Panel labelledBy="live-activity-title">
      <PanelHeading id="live-activity-title" eyebrow="Event stream" title="Live activity" detail="Live" />

      <ol aria-live="polite" className="flex flex-col">
        {entries.map((entry, index) => (
          <li
            key={entry.id}
            className={`flex h-[47px] items-center gap-2.5 border-b border-line ${
              index >= PHONE_ENTRY_LIMIT ? 'max-md:hidden' : ''
            }`}
          >
            <ToneDot tone={entry.tone} />
            <time
              dateTime={new Date(entry.timestamp).toISOString()}
              className="w-[58px] shrink-0 font-mono text-[9px] text-ink-muted"
            >
              {formatClockTime(entry.timestamp)}
            </time>
            <span className="min-w-0 flex-1 truncate text-[10px] text-ink-soft max-md:text-sm">
              {entry.message}
            </span>
          </li>
        ))}
      </ol>

      <Link
        href="/logs"
        className="flex h-11 items-center justify-center rounded-control border border-line-control text-sm text-ink-soft md:hidden"
      >
        See all
      </Link>

      <ul aria-label="Indicator key" className="flex gap-3 max-md:hidden">
        {LEGEND.map((item) => (
          <li key={item.tone} className="flex items-center gap-[5px] font-mono text-[8px] text-ink-muted">
            <ToneDot tone={item.tone} size="sm" />
            {item.label}
          </li>
        ))}
      </ul>
    </Panel>
  )
}
