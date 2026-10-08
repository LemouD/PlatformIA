'use client'

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { createMockEventSource } from '@/events/mock-source'
import type { AgentEventSource, ApprovalDecision } from '@/events/source'
import type { AgentAvailability } from '@/domain/types'
import { mockAgents } from '@/mocks/agents'
import { mockSnapshot } from '@/mocks/snapshot'
import { browserScheduler } from './scheduler'
import { createInitialState } from './system-state'
import type { SystemState } from './system-state'
import { createSystemStore } from './system-store'
import type { SystemStore } from './system-store'

interface SystemContextValue {
  store: SystemStore
  submitCommand(command: string): void
  decide(approvalId: string, decision: ApprovalDecision): void
  setAvailability(agentId: string, availability: AgentAvailability): void
}

const SystemContext = createContext<SystemContextValue | null>(null)

function createSeededStore(): SystemStore {
  const initial = { ...createInitialState(mockAgents, mockSnapshot.metrics), activity: mockSnapshot.activity }
  return createSystemStore(initial, browserScheduler)
}

/**
 * Owns the system store and connects it to the event source. Today the source is the
 * scripted mock; chantier 2 swaps in the server stream without touching the components.
 */
export function SystemProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createSeededStore)
  // The source only exists in the browser; actions read it when the user acts, never during render.
  const source = useRef<AgentEventSource | null>(null)

  useEffect(() => {
    const created = createMockEventSource(browserScheduler, { pendingApprovals: mockSnapshot.approvals })
    const unsubscribe = created.subscribe(store.dispatch)
    source.current = created
    return () => {
      unsubscribe()
      created.dispose()
      source.current = null
    }
  }, [store])

  useEffect(() => () => store.dispose(), [store])

  const [value] = useState<SystemContextValue>(() => ({
    store,
    submitCommand: (command) => source.current?.submitCommand(command),
    decide: (approvalId, decision) => source.current?.decide(approvalId, decision),
    setAvailability: (agentId, availability) => source.current?.setAvailability(agentId, availability),
  }))

  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>
}

function useSystemContext(): SystemContextValue {
  const value = useContext(SystemContext)
  if (!value) throw new Error('useSystem must be used inside <SystemProvider>')
  return value
}

/** The live system state; re-renders the caller on every applied event. */
export function useSystemState(): SystemState {
  const { store } = useSystemContext()
  return useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

export function useSystemActions() {
  const { submitCommand, decide, setAvailability } = useSystemContext()
  return { submitCommand, decide, setAvailability }
}
