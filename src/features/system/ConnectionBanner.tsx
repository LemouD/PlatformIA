'use client'

import { WifiOff } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useNow } from '@/lib/useNow'
import { useSystemActions, useSystemState } from '@/store/SystemProvider'
import { interruptionDetail } from './connection-view'

/**
 * Slides in under the navigation while live updates are cut (design spec 15.4). No modal:
 * the interface stays usable, commands and approvals leave when the stream is back.
 */
export function ConnectionBanner() {
  const { connection, lastEventAt } = useSystemState()
  const { reconnect } = useSystemActions()
  const now = useNow(1000)
  const reduced = useReducedMotion() ?? false

  return (
    <AnimatePresence>
      {connection.status === 'interrupted' ? (
        <motion.div
          key="connection-banner"
          role="status"
          className="sticky top-14 z-30 border-b border-warning/50 bg-[color-mix(in_srgb,var(--color-warning)_10%,var(--color-canvas))] md:top-[72px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 md:px-9">
            <WifiOff aria-hidden size={16} className="shrink-0 text-warning" />
            <p className="text-sm font-semibold text-ink">Live updates are interrupted</p>
            <p className="font-mono text-[11px] text-ink-soft">
              {interruptionDetail(lastEventAt ?? connection.since, connection.retryAt, now ?? connection.since)}
            </p>
            <button
              type="button"
              onClick={reconnect}
              className="min-h-11 text-sm text-warning underline underline-offset-4 md:ml-auto md:min-h-0"
            >
              Retry now
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
