import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { decodeAgentId } from '@/config/navigation'
import { AgentDetail } from '@/features/agents/AgentDetail'
import { mockAgents } from '@/mocks/agents'

interface AgentPageProps {
  params: Promise<{ id: string }>
}

// Agents come and go at run time, so the page is rendered on request rather than listed at build.

/** The agent named by the URL segment, which arrives still encoded (see agentHref). */
async function findAgent(params: AgentPageProps['params']) {
  const id = decodeAgentId((await params).id)
  return id === null ? undefined : mockAgents.find((agent) => agent.id === id)
}

export async function generateMetadata({ params }: AgentPageProps): Promise<Metadata> {
  return { title: (await findAgent(params))?.name ?? 'Agent' }
}

export default async function AgentPage({ params }: AgentPageProps) {
  const agent = await findAgent(params)
  if (!agent) notFound()
  return <AgentDetail agentId={agent.id} />
}
