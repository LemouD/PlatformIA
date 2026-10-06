import { countOnlineSpecialists } from '@/domain/selectors'
import type { CommandCenterSnapshot } from '@/domain/types'
import { formatCompactNumber, formatPercent, formatUsd } from '@/lib/format'

export interface MetricItem {
  label: string
  value: string
}

export function buildSystemMetrics(snapshot: CommandCenterSnapshot): MetricItem[] {
  return [
    { label: 'Agents', value: `${countOnlineSpecialists(snapshot.agents)} online` },
    { label: 'Tasks', value: `${snapshot.metrics.runningTasks} running` },
    { label: 'API', value: formatPercent(snapshot.metrics.apiUptime) },
    { label: 'Tokens', value: formatCompactNumber(snapshot.metrics.tokens) },
    { label: 'Cost today', value: formatUsd(snapshot.metrics.costTodayUsd) },
  ]
}
