import { createBudgetGuard, startOfDay, startOfMonth, type BudgetGuard, type Reservation } from '../limits/budget'
import type { ConversationProfile, UsageLedger } from './types'

export type BudgetRefusal = 'daily_budget_reached' | 'monthly_budget_reached'

export interface UserBudgets {
  /** Reserves against the daily, then the monthly ceiling of this user and profile. */
  reserve(userId: string, profile: ConversationProfile, amountUsd: number, now: number): Promise<Reservation | BudgetRefusal>
  remaining(userId: string, profile: ConversationProfile, now: number): Promise<{ dailyLeftUsd: number; monthlyLeftUsd: number }>
}

/** One pair of guards per user and profile: neither user can block the other. */
export function createUserBudgets(ledger: UsageLedger): UserBudgets {
  const guards = new Map<string, { day: BudgetGuard; month: BudgetGuard }>()
  const guardsFor = (userId: string, profileId: string) => {
    const key = JSON.stringify([userId, profileId])
    let pair = guards.get(key)
    if (!pair) {
      pair = { day: createBudgetGuard(), month: createBudgetGuard() }
      guards.set(key, pair)
    }
    return pair
  }

  return {
    async reserve(userId, profile, amountUsd, now) {
      const pair = guardsFor(userId, profile.id)
      const day = await pair.day.reserve(
        amountUsd,
        () => ledger.sumCostSince(userId, profile.id, startOfDay(now)),
        profile.budget.dailyUsd,
      )
      if (!day) return 'daily_budget_reached'
      const month = await pair.month.reserve(
        amountUsd,
        () => ledger.sumCostSince(userId, profile.id, startOfMonth(now)),
        profile.budget.monthlyUsd,
      )
      if (!month) {
        day.release()
        return 'monthly_budget_reached'
      }
      return {
        release() {
          day.release()
          month.release()
        },
      }
    },

    async remaining(userId, profile, now) {
      const [today, month] = await Promise.all([
        ledger.sumCostSince(userId, profile.id, startOfDay(now)),
        ledger.sumCostSince(userId, profile.id, startOfMonth(now)),
      ])
      return {
        dailyLeftUsd: Math.max(0, profile.budget.dailyUsd - today),
        monthlyLeftUsd: Math.max(0, profile.budget.monthlyUsd - month),
      }
    },
  }
}

/** Start of the next day or month, shown to her when a ceiling is reached. */
export function resetsAt(refusal: BudgetRefusal, now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  if (refusal === 'daily_budget_reached') d.setDate(d.getDate() + 1)
  else d.setMonth(d.getMonth() + 1, 1)
  return d.getTime()
}
