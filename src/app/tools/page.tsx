import type { Metadata } from 'next'
import { ComingSoon } from '@/components/ui/ComingSoon'

export const metadata: Metadata = { title: 'Tools' }

export default function ToolsPage() {
  return (
    <ComingSoon title="Tools" description="Tools available to agents and their permissions." />
  )
}
