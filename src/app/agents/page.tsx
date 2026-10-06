import type { Metadata } from 'next'
import { ComingSoon } from '@/components/ui/ComingSoon'

export const metadata: Metadata = { title: 'Agents' }

export default function AgentsPage() {
  return <ComingSoon title="Agents" description="Every agent, its status and its current task." />
}
