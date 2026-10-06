import type { Tone } from '@/domain/types'

export const TONE_CLASSES: Record<Tone, { text: string; border: string; bg: string }> = {
  info: { text: 'text-info', border: 'border-info', bg: 'bg-info' },
  accent: { text: 'text-accent', border: 'border-accent', bg: 'bg-accent' },
  success: { text: 'text-success', border: 'border-success', bg: 'bg-success' },
  warning: { text: 'text-warning', border: 'border-warning', bg: 'bg-warning' },
  danger: { text: 'text-danger', border: 'border-danger', bg: 'bg-danger' },
}
