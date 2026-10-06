import type { SystemHealth } from '@/domain/types'

export interface Session {
  userInitials: string
  health: SystemHealth
}

export const mockSession: Session = {
  userInitials: 'AM',
  health: 'nominal',
}
