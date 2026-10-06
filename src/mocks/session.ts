export type SystemHealth = 'nominal' | 'degraded'

export interface Session {
  userInitials: string
  health: SystemHealth
}

export const mockSession: Session = {
  userInitials: 'AM',
  health: 'nominal',
}
