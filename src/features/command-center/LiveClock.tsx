'use client'

import { useSyncExternalStore } from 'react'
import { formatHeadingDate } from '@/lib/format'

const MINUTE = 60_000

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, 15_000)
  return () => clearInterval(id)
}

function getMinute(): number {
  return Math.floor(Date.now() / MINUTE)
}

function getServerMinute(): null {
  return null
}

export function LiveClock() {
  const minute = useSyncExternalStore<number | null>(subscribe, getMinute, getServerMinute)

  return (
    <p className="min-h-3 font-mono text-[9px] text-info">
      {minute === null ? '' : formatHeadingDate(new Date(minute * MINUTE))}
    </p>
  )
}
