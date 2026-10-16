'use client'

import { formatClockTime } from '@/lib/format'
import { useLastKnownAt } from '@/store/SystemProvider'

/** "LAST KNOWN · 16:42:39" while the live stream is cut, nothing otherwise (design spec 15.4). */
export function LastKnownTag() {
  const lastKnownAt = useLastKnownAt()
  if (lastKnownAt === null) return null
  return <p className="font-mono text-[10px] uppercase text-warning">Last known · {formatClockTime(lastKnownAt)}</p>
}
