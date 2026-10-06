import { TONE_CLASSES } from '@/design/tone'
import type { Tone } from '@/domain/types'

interface ToneDotProps {
  tone: Tone
  size?: 'sm' | 'md'
}

export function ToneDot({ tone, size = 'md' }: ToneDotProps) {
  const dimension = size === 'sm' ? 'size-[5px]' : 'size-[7px]'
  return <span aria-hidden className={`shrink-0 rounded-full ${dimension} ${TONE_CLASSES[tone].bg}`} />
}
