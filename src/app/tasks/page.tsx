import type { Metadata } from 'next'
import { ComingSoon } from '@/components/ui/ComingSoon'

export const metadata: Metadata = { title: 'Tasks' }

export default function TasksPage() {
  return <ComingSoon title="Tasks" description="Follow every task from request to completion." />
}
