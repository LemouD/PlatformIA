import { Panel, PanelHeading } from '@/components/ui/Panel'
import { STATUS_META } from '@/design/status'
import type { AgentStatus } from '@/domain/types'
import { AgentRobot } from '@/features/agents/robot/AgentRobot'

const SPECIMENS: readonly { status: AgentStatus; label: string }[] = [
  { status: 'IDLE', label: 'Idle' },
  { status: 'WORKING', label: 'Working' },
  { status: 'THINKING', label: 'Thinking' },
  { status: 'WAITING_APPROVAL', label: 'Waiting for approval' },
  { status: 'ERROR', label: 'Error' },
  { status: 'COMPLETED', label: 'Completed' },
]

export function AgentStates() {
  return (
    <Panel labelledBy="agent-states-title">
      <PanelHeading id="agent-states-title" eyebrow="Behavior specimen" title="Agent states" />
      <ul className="grid grid-cols-3 gap-2">
        {SPECIMENS.map(({ status, label }) => (
          <li
            key={status}
            className={`flex h-[72px] items-center gap-1.5 overflow-hidden rounded-control border-l bg-surface-sunken px-2 ${STATUS_META[status].border}`}
          >
            <AgentRobot
              status={status}
              environment="generic"
              role="specialist"
              variant="specimen"
              facing="right"
              moving={false}
            />
            <span className="flex min-w-0 flex-col gap-1">
              <span aria-hidden className={`size-1.5 rounded-full ${STATUS_META[status].bg}`} />
              <span className="font-mono text-[7px] uppercase leading-tight text-ink-soft">{label}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
