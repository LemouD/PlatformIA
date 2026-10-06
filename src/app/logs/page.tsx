import type { Metadata } from 'next'
import { ComingSoon } from '@/components/ui/ComingSoon'

export const metadata: Metadata = { title: 'Logs' }

export default function LogsPage() {
  return <ComingSoon title="Logs" description="A live, filterable stream of system logs." />
}
