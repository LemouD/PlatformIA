import type { CommandCenterSnapshot } from '@/domain/types'
import { mockAgents } from './agents'

function at(hours: number, minutes: number, seconds: number): number {
  return new Date(2026, 9, 1, hours, minutes, seconds).getTime()
}

export const mockSnapshot: CommandCenterSnapshot = {
  agents: mockAgents,
  activity: [
    { id: 'activity-1', timestamp: at(16, 42, 31), tone: 'info', message: 'Research Agent started a task' },
    { id: 'activity-2', timestamp: at(16, 42, 34), tone: 'success', message: 'Web search completed' },
    { id: 'activity-3', timestamp: at(16, 42, 36), tone: 'success', message: 'Research Agent retrieved 12 documents' },
    { id: 'activity-4', timestamp: at(16, 42, 39), tone: 'info', message: 'NOVA is processing results' },
    { id: 'activity-5', timestamp: at(16, 42, 42), tone: 'success', message: 'Task completed' },
  ],
  metrics: {
    runningTasks: 12,
    apiUptime: 99.9,
    tokens: 12_400,
    costTodayUsd: 2.41,
  },
  health: 'nominal',
  syncedAt: at(16, 42, 42),
  objective: 'Compile the latest platform research into an implementation brief',
  handoffChain: ['nova', 'coding'],
  suggestions: [
    'Research the latest Power Platform news...',
    'Analyze my documents...',
    'Turn off the lights...',
    'Create a new agent...',
  ],
  approvals: [
    {
      id: 'approval-1',
      agentId: 'personal',
      executionId: null,
      summary: 'Send the weekly family menu to the shared calendar',
      requestedAt: at(16, 41, 58),
      action: 'Create 7 calendar events',
      dataUsed: 'Weekly menu drafted by Personal Agent',
      leavesAiOs: true,
      preview:
        'Mon: lentil soup\nTue: chicken yassa\nWed: vegetable gratin\nThu: thieboudienne\nFri: pizza night\nSat: grilled fish\nSun: family brunch',
    },
  ],
}
