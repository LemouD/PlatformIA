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
  reconnect(): void
}

const SystemContext = createContext<SystemContextValue | null>(null)

/** Development aid: open any page with ?simulate=outage to see the stream cut 3 s later. */
const SIMULATED_OUTAGE_DELAY_MS = 3000

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
    const unsubscribeConnection = created.subscribeConnection(store.setConnection)
    source.current = created

    let outage: ReturnType<typeof setTimeout> | undefined
    const simulate = new URLSearchParams(window.location.search).get('simulate') === 'outage'
    if (process.env.NODE_ENV !== 'production' && simulate) {
      outage = setTimeout(() => created.interrupt(), SIMULATED_OUTAGE_DELAY_MS)
    }

    return () => {
      clearTimeout(outage)
      unsubscribe()
      unsubscribeConnection()
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
    reconnect: () => source.current?.reconnect(),
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

/** One value derived from the state; re-renders the caller only when that value changes. */
export function useSystemSelector<T extends string | number | boolean | null>(select: (state: SystemState) => T): T {
  const { store } = useSystemContext()
  const read = () => select(store.getState())
  return useSyncExternalStore(store.subscribe, read, read)
}

const noSubscription = () => () => {}

/** True while the live stream is cut: robots hold their last pose (spec 15.4). False outside the provider. */
export function useStreamFrozen(): boolean {
  const value = useContext(SystemContext)
  const read = () => value?.store.getState().connection.status === 'interrupted'
  return useSyncExternalStore(value?.store.subscribe ?? noSubscription, read, read)
}

/** While the stream is cut, the time of the last known state; null when live or outside the provider. */
export function useLastKnownAt(): number | null {
  const value = useContext(SystemContext)
  const read = () => {
    const state = value?.store.getState()
    if (!state || state.connection.status === 'live') return null
    return state.lastEventAt ?? state.connection.since
  }
  return useSyncExternalStore(value?.store.subscribe ?? noSubscription, read, read)
}

export function useSystemActions() {
  const { submitCommand, decide, setAvailability, reconnect } = useSystemContext()
  return { submitCommand, decide, setAvailability, reconnect }
}
