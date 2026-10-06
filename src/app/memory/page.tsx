import type { Metadata } from 'next'
import { ComingSoon } from '@/components/ui/ComingSoon'

export const metadata: Metadata = { title: 'Memory' }

export default function MemoryPage() {
  return <ComingSoon title="Memory" description="Conversation, personal and agent memory." />
}
