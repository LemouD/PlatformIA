import type { Approval } from '@/domain/events'

/** Oldest request first, so nothing waits forever at the bottom of the stack. */
export function sortPendingApprovals(approvals: readonly Approval[]): Approval[] {
  return [...approvals].sort((a, b) => a.requestedAt - b.requestedAt || a.id.localeCompare(b.id))
}

/** How far the sheet must be dragged down, in px, before it closes. */
export const SHEET_DISMISS_DISTANCE = 80

export function shouldDismissSheet(dragDistance: number): boolean {
  return dragDistance >= SHEET_DISMISS_DISTANCE
}
