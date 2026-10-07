import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ComingSoon } from '@/components/ui/ComingSoon'
import { mockAgents } from '@/mocks/agents'

interface AgentPageProps {
  params: Promise<{ id: string }>
}

function findAgent(id: string) {
  return mockAgents.find((agent) => agent.id === id)
}

export function generateStaticParams() {
  return mockAgents.map((agent) => ({ id: agent.id }))
}

export async function generateMetadata({ params }: AgentPageProps): Promise<Metadata> {
  const { id } = await params
  return { title: findAgent(id)?.name ?? 'Agent' }
}

export default async function AgentPage({ params }: AgentPageProps) {
  const { id } = await params
  const agent = findAgent(id)
  if (!agent) notFound()
  return <ComingSoon title={agent.name} description={agent.description} />
}
