'use client'

import { useMemo } from 'react'
import { mockSnapshot } from '@/mocks/snapshot'
import { buildSnapshot } from '@/store/snapshot'
import { useSystemActions, useSystemState } from '@/store/SystemProvider'
import { CommandCenter } from './CommandCenter'

const DEFAULTS = {
  objective: mockSnapshot.objective,
  suggestions: mockSnapshot.suggestions,
  syncedAt: mockSnapshot.syncedAt,
}

/** The Command Center fed by the live system state instead of a fixed snapshot. */
export function LiveCommandCenter() {
  const state = useSystemState()
  const { submitCommand, decide } = useSystemActions()
  const snapshot = useMemo(() => buildSnapshot(state, DEFAULTS), [state])
  return <CommandCenter snapshot={snapshot} onCommand={submitCommand} onDecide={decide} />
}
