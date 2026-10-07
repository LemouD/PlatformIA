import type { AllowedModel } from '../definitions/types'
import { costUsd } from './pricing'

export function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function startOfMonth(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  d.setDate(1)
  return d.getTime()
}

const TOKENS_PER_CHAR = 0.5
const TOKENS_PER_IMAGE = 1600
const TOKENS_PER_PDF_PAGE = 3000

/** Upper bound of a call's cost: conservative input estimate plus the whole output ceiling. */
export function estimateMaxCostUsd(
  model: AllowedModel,
  size: { textChars: number; images: number; pdfPages: number; maxOutputTokens: number },
): number {
  const inputTokens =
    Math.ceil(size.textChars * TOKENS_PER_CHAR) + size.images * TOKENS_PER_IMAGE + size.pdfPages * TOKENS_PER_PDF_PAGE
  return costUsd(model, inputTokens, size.maxOutputTokens)
}

export interface Reservation {
  release(): void
}

export interface BudgetGuard {
  /** Reserves `amountUsd` if spent + reserved + amount stays within the limit; null otherwise. */
  reserve(amountUsd: number, spentSoFar: () => Promise<number>, limitUsd: number): Promise<Reservation | null>
}

/**
 * Serialises reservations so two simultaneous runs cannot both pass the check.
 * Valid for a single server process, which is the deployment model of AI OS.
 */
export function createBudgetGuard(): BudgetGuard {
  let reserved = 0
  let queue: Promise<unknown> = Promise.resolve()

  return {
    reserve(amountUsd, spentSoFar, limitUsd) {
      const attempt = queue.then(async (): Promise<Reservation | null> => {
        const spent = await spentSoFar()
        if (spent + reserved + amountUsd > limitUsd) return null
        reserved += amountUsd
        let released = false
        return {
          release() {
            if (released) return
            released = true
            reserved -= amountUsd
          },
        }
      })
      queue = attempt.catch(() => undefined)
      return attempt
    },
  }
}
