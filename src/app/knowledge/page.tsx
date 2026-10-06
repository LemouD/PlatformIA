import type { Metadata } from 'next'
import { ComingSoon } from '@/components/ui/ComingSoon'

export const metadata: Metadata = { title: 'Knowledge' }

export default function KnowledgePage() {
  return (
    <ComingSoon title="Knowledge" description="Indexed documents and the sources agents used." />
  )
}
